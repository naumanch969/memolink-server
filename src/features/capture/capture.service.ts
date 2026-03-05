import { logger } from '../../config/logger';
import { ApiError } from '../../core/errors/api.error';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import { HTTP_STATUS } from '../../shared/constants';
import { MongoUtil } from '../../shared/utils/mongo.utils';
import { enrichmentService } from '../enrichment/enrichment.service';
import { entityService } from '../entity/entity.service';
import entryService from '../entry/entry.service';
import { NodeType } from '../graph/edge.model';
import { tagService } from '../tag/tag.service';
import webActivityService from '../web-activity/web-activity.service';
import { activeEntryAdapter } from './adapters/active-entry.adapter';
import { BaseCaptureAdapter, NormalizedCapture } from './adapters/base.adapter';
import { mobileAppAdapter } from './adapters/mobile-app.adapter';
import { webExtensionAdapter } from './adapters/web-extension.adapter';
import { whatsappAdapter } from './adapters/whatsapp.adapter';
import { CaptureSource, ICaptureService } from './capture.interfaces';

export class CaptureService implements ICaptureService {
    private _adapters: Map<string, BaseCaptureAdapter<any>> = new Map();

    constructor() {
        this.registerAdapter(activeEntryAdapter);
        this.registerAdapter(webExtensionAdapter);
        this.registerAdapter(mobileAppAdapter);
        this.registerAdapter(whatsappAdapter);
    }

    public registerAdapter(adapter: BaseCaptureAdapter<any>) {
        this._adapters.set(adapter.source, adapter);
        logger.debug(`CaptureService: Registered adapter for ${adapter.source}`);
    }

    /**
     * Unified entry point for all capture sources.
     * Normalizes payload via registered adapter and handles downstream funneling.
     */
    async ingest(userId: string, source: CaptureSource, payload: any): Promise<void> {
        const adapter = this._adapters.get(source);
        if (!adapter) {
            throw new ApiError(`No capture adapter registered for source: ${source}`, HTTP_STATUS.BAD_REQUEST);
        }

        try {
            const normalized = await adapter.normalize(userId, payload);
            const captures = Array.isArray(normalized) ? normalized : [normalized];

            for (const capture of captures) {
                await this.handleNormalized(userId, capture, source);
            }
        } catch (error: any) {
            logger.error(`CaptureService: Ingestion failed for source ${source}`, error);
            throw error;
        }
    }

    /**
     * Internal router that funnels normalized captures to domain services.
     */
    private async handleNormalized(userId: string, capture: NormalizedCapture, source: CaptureSource): Promise<void> {
        if (capture.sourceType === 'active') {
            await this.handleActiveCapture(userId, capture, source);
        } else {
            await this.handlePassiveCapture(userId, capture, source);
        }
    }

    /**
     * Handles active human intent captures.
     * Performs intelligence resolution (Mentions/Tags) and triggers enrichment.
     */
    private async handleActiveCapture(userId: string, capture: NormalizedCapture, source: CaptureSource): Promise<void> {
        const sessionId = `${source}-session`;

        // 1. Resolve Intelligence (Mentions/Tags)
        const { mentionIds, tagIds } = await this.resolveIntelligence(userId, capture);

        // 2. Create Entry
        const entry = await entryService.createEntry(userId, {
            content: capture.payload.rawText || '',
            type: capture.inputMethod === 'voice' ? 'mixed' : 'text',
            date: capture.timestamp || new Date(),
            mentions: mentionIds,
            tags: tagIds,
            metadata: {
                ...capture.payload.metadata,
                sessionId
            }
        });

        // 3. Notify and Enrich
        socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, entry);
        await enrichmentService.enqueueActiveEnrichment(userId, entry._id.toString(), sessionId);

        logger.info(`CaptureService: Active entry funneled [User: ${userId}, Source: ${source}, Entry: ${entry._id}]`);
    }

    /**
     * Handles passive/ambient captures like web activity.
     */
    private async handlePassiveCapture(userId: string, capture: NormalizedCapture, source: CaptureSource): Promise<void> {
        const metadata = capture.payload.metadata || {};

        if (source === 'web-extension' || source === 'desktop-app' || source === 'mobile-app') {
            await webActivityService.syncActivity(userId, {
                syncId: metadata.syncId || `sync-${Date.now()}`,
                date: capture.timestamp || new Date(),
                totalSeconds: capture.payload.activeSeconds || 0,
                productiveSeconds: metadata.productiveSeconds || 0,
                distractingSeconds: metadata.distractingSeconds || 0,
                domainMap: metadata.domainMap || (capture.payload.url ? { [capture.payload.url]: capture.payload.activeSeconds || 0 } : {})
            });
        }
        logger.info(`CaptureService: Passive data funneled [User: ${userId}, Source: ${source}]`);
    }

    /**
     * Resolves raw signals into concrete database IDs.
     */
    private async resolveIntelligence(userId: string, capture: NormalizedCapture): Promise<{ mentionIds: string[], tagIds: string[] }> {
        const metadata = capture.payload.metadata || {};

        // Resolve Mentions
        const mentionIds = [...(metadata.mentions || [])];
        const extractedMentions = metadata.extractedMentions || [];
        for (const name of extractedMentions) {
            const entity = await entityService.findOrCreateEntity(userId, name, NodeType.PERSON);
            mentionIds.push(entity._id.toString());
        }

        // Resolve Tags
        const tagSet = new Set<string>();
        if (metadata.tags) metadata.tags.forEach((t: string) => tagSet.add(t));
        if (metadata.extractedTags) metadata.extractedTags.forEach((t: string) => tagSet.add(t));

        const tagIds: string[] = [];
        for (const tagIdentifier of Array.from(tagSet)) {
            if (MongoUtil.isValidObjectId(tagIdentifier)) {
                tagIds.push(tagIdentifier);
            } else {
                const tag = await tagService.findOrCreateTag(userId, tagIdentifier);
                tagIds.push(tag._id.toString());
            }
        }

        return {
            mentionIds: Array.from(new Set(mentionIds)),
            tagIds: Array.from(new Set(tagIds))
        };
    }

    // --- Legacy / Compatibility Layer ---

    async ingestEntry(userId: string, payload: any): Promise<void> {
        return this.ingest(userId, 'active-entry', payload);
    }

    async ingestWeb(userId: string, payload: any): Promise<void> {
        return this.ingest(userId, 'web-extension', payload);
    }

    async ingestWhatsApp(userId: string, payload: any): Promise<void> {
        return this.ingest(userId, 'whatsapp', payload);
    }

    async ingestAppActivity(userId: string, source: 'mobile-app' | 'desktop-app', payload: any): Promise<void> {
        return this.ingest(userId, source, payload);
    }
}

export const captureService: ICaptureService = new CaptureService();
