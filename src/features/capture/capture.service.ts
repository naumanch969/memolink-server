import crypto from 'crypto';
import { logger } from '../../config/logger';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import DateUtil from '../../shared/utils/date.utils';
import { MongoUtil } from '../../shared/utils/mongo.utils';
import { StringUtil } from '../../shared/utils/string.utils';
import { enrichmentService } from '../enrichment/enrichment.service';
import { entityService } from '../entity/entity.service';
import entryService from '../entry/entry.service';
import { CreateEntryRequest, IEntry } from '../entry/entry.types';
import { NodeType } from '../graph/edge.model';
import { tagService } from '../tag/tag.service';
import webActivityService from '../web-activity/web-activity.service';
import { ActivitySyncBatch } from '../web-activity/web-activity.types';
import { ICapturePayload, ICaptureService, WhatsAppPayload } from './capture.interfaces';

export class CaptureService implements ICaptureService {

    // 1. ACTIVE: Text/Voice/Manual Entry
    async captureEntry(userId: string, payload: ICapturePayload): Promise<IEntry> {
        const entryDate = payload.date ? new Date(payload.date) : new Date();
        const sessionId = DateUtil.getSessionId(entryDate);
        const content = payload.content || '';

        // Resolve Intelligence (Mentions/Tags) into IDs
        const { mentionIds, tagIds } = await this.resolveIntelligence(userId, {
            content,
            providedTags: payload.tags || [],
            providedMentions: payload.metadata?.mentions || []
        });

        // Determine input method
        const isMediaOrVoice = payload.type === 'media' || payload.type === 'voice' || payload.metadata?.isVoice;
        const method = isMediaOrVoice ? 'voice' : 'text';
        const inputMethodValue = payload.metadata?.source === 'whatsapp' ? 'whatsapp' : method;

        // Create Entry synchronously
        const entryData: CreateEntryRequest = {
            content: content,
            status: 'capturing',
            type: method === 'voice' ? 'mixed' : 'text',
            inputMethod: inputMethodValue,
            date: entryDate,
            startDate: payload.startDate ? new Date(payload.startDate) : undefined,
            endDate: payload.endDate ? new Date(payload.endDate) : undefined,
            startTime: payload.startTime,
            endTime: payload.endTime,
            isMultiDay: payload.isMultiDay,
            kind: payload.kind,
            isPrivate: payload.isPrivate,
            isPinned: payload.isPinned,
            isImportant: payload.isImportant,
            tags: tagIds,
            media: payload.media,
            collectionId: payload.collectionId,
            title: payload.title,
            location: payload.location,
            mood: payload.mood,
            metadata: {
                ...payload.metadata,
                sessionId,
                referenceId: payload._id,
                originalType: payload.type,
                mentions: mentionIds
            }
        };

        const entry = await entryService.createEntry(userId, entryData);

        // Inform client immediately
        socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, entry);

        // Queue enrichment asynchronously
        await enrichmentService.enqueueActiveEnrichment(userId, entry._id.toString(), sessionId);

        logger.info(`CaptureService: Active entry captured [User: ${userId}, Entry: ${entry._id}]`);
        return entry;
    }

    // 2. PASSIVE: Web Extension Sync
    async captureWeb(userId: string, payload: ActivitySyncBatch): Promise<void> {
        const activityData = {
            syncId: payload.syncId || `sync-${crypto.randomUUID()}`,
            date: payload.date ? new Date(payload.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            totalSeconds: payload.totalSeconds || 0,
            productiveSeconds: payload.productiveSeconds || 0,
            distractingSeconds: payload.distractingSeconds || 0,
            domainMap: payload.domainMap || {}
        };

        // Sync daily activity
        await webActivityService.syncActivity(userId, activityData);

        // Trigger passive enrichment evaluation logic (WebActivity based)
        await enrichmentService.evaluatePassiveGate(userId, activityData.date);

        logger.info(`CaptureService: Passive web data funneled [User: ${userId}]`);
    }

    // 3. WhatsApp
    async captureWhatsApp(userId: string, payload: WhatsAppPayload): Promise<void> {
        // WhatsApp enters as an active entry but from the bot
        const metadata = {
            whatsapp_from: payload.from,
            whatsapp_name: payload.senderName,
            whatsapp_media: payload.mediaUrl,
            isVoice: payload.isVoice,
            source: 'whatsapp'
        };

        const entryPayload: ICapturePayload = {
            content: payload.body,
            type: payload.isVoice ? 'media' : 'text',
            date: payload.timestamp ? new Date(payload.timestamp) : new Date(),
            metadata
        };

        await this.captureEntry(userId, entryPayload);
    }

    private async resolveIntelligence(
        userId: string,
        params: { content: string, providedTags: string[], providedMentions: string[] }
    ): Promise<{ mentionIds: string[], tagIds: string[] }> {
        const { content, providedTags, providedMentions } = params;

        const mentionIds = await this.resolveMentions(userId, content, providedMentions);
        const tagIds = await this.resolveTags(userId, content, providedTags);

        return { mentionIds, tagIds };
    }

    private async resolveMentions(userId: string, content: string, provided: string[]): Promise<string[]> {
        const mentionIdSet = new Set<string>(provided);
        const extracted = StringUtil.extractMentions(content);

        await Promise.all(extracted.map(async (name) => {
            const entity = await entityService.findOrCreateEntity(userId, name, NodeType.PERSON);
            mentionIdSet.add(entity._id.toString());
        }));

        return Array.from(mentionIdSet);
    }

    private async resolveTags(userId: string, content: string, provided: string[]): Promise<string[]> {
        const tagIdentifierSet = new Set<string>(provided);
        const extracted = StringUtil.extractTags(content);
        extracted.forEach(t => tagIdentifierSet.add(t));

        const tagIds = await Promise.all(
            Array.from(tagIdentifierSet).map(async (tagIdentifier) => {
                if (MongoUtil.isValidObjectId(tagIdentifier)) {
                    return tagIdentifier;
                } else {
                    const tag = await tagService.findOrCreateTag(userId, tagIdentifier);
                    return tag._id.toString();
                }
            })
        );

        return tagIds;
    }
}

export const captureService: ICaptureService = new CaptureService();
