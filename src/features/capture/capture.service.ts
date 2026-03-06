import { logger } from '../../config/logger';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import DateUtil from '../../shared/utils/date.utils';
import { MongoUtil } from '../../shared/utils/mongo.utils';
import { StringUtil } from '../../shared/utils/string.utils';
import { enrichmentService } from '../enrichment/enrichment.service';
import { entityService } from '../entity/entity.service';
import entryService from '../entry/entry.service';
import { NodeType } from '../graph/edge.model';
import { tagService } from '../tag/tag.service';
import webActivityService from '../web-activity/web-activity.service';
import { ICaptureService, MobileActivityPayload, WhatsAppPayload } from './capture.interfaces';

export class CaptureService implements ICaptureService {

    // 1. ACTIVE: Text/Voice/Manual Entry
    async captureEntry(userId: string, payload: any): Promise<any> {
        const entryDate = payload.date || new Date();
        const sessionId = DateUtil.getSessionId(entryDate);

        const content = payload.content || '';

        // Extract Tags & Mentions from text
        const extractedMentions = StringUtil.extractMentions(content);
        const extractedTags = StringUtil.extractTags(content);

        // Resolve Intelligence (Mentions/Tags) into IDs
        const { mentionIds, tagIds } = await this.resolveIntelligence(userId, {
            tags: payload.tags || [],
            extractedMentions,
            extractedTags,
            mentions: payload.metadata?.mentions || []
        });

        // Determine input type
        let method = 'text';
        if (payload.type === 'media' || payload.metadata?.isVoice) method = 'voice';

        // Create Entry synchronously
        const entry = await entryService.createEntry(userId, {
            content: content,
            status: 'capturing',
            type: method === 'voice' ? 'mixed' : 'text',
            date: entryDate,
            tags: tagIds,
            media: payload.media,
            collectionId: payload.collectionId,
            title: payload.title,
            location: payload.location,
            metadata: {
                ...payload.metadata,
                sessionId,
                referenceId: payload._id,
                originalType: payload.type,
                mentions: mentionIds
            }
        });

        // Inform client immediately
        socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, entry);

        // Queue enrichment asynchronously
        await enrichmentService.enqueueActiveEnrichment(userId, entry._id.toString(), sessionId);

        logger.info(`CaptureService: Active entry captured [User: ${userId}, Entry: ${entry._id}]`);
        return entry;
    }

    // 2. PASSIVE: Web Extension Sync
    async captureWeb(userId: string, payload: any): Promise<void> {
        const activityData = {
            syncId: payload.syncId || `sync-${Date.now()}`,
            date: payload.date ? new Date(payload.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            totalSeconds: payload.totalSeconds || 0,
            productiveSeconds: payload.productiveSeconds || 0,
            distractingSeconds: payload.distractingSeconds || 0,
            domainMap: payload.domainMap || {}
        };

        // Sync daily activity (Legacy/Global Analytics)
        await webActivityService.syncActivity(userId, activityData);

        // Track session-level activity (Enrichment Engine Context)
        await enrichmentService.trackSessionActivity(userId, activityData);

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

        // Reuse the same flow as captureEntry, supplying the normalized payload
        const entryPayload = {
            content: payload.body,
            type: payload.isVoice ? 'media' : 'text',
            date: payload.timestamp ? new Date(payload.timestamp) : new Date(),
            metadata
        };

        await this.captureEntry(userId, entryPayload);
    }

    // 4. App Logging (Mobile / Desktop bounds)
    async captureAppActivity(userId: string, source: 'mobile-app' | 'desktop-app', payload: MobileActivityPayload | MobileActivityPayload[]): Promise<void> {
        const timestamp = new Date().toISOString().split('T')[0];
        const rawEvents = Array.isArray(payload) ? payload : [payload];
        let totalActive = 0;
        const appMap: Record<string, number> = {};

        for (const event of rawEvents) {
            totalActive += event.activeSeconds || 0;
            appMap[event.appName || event.bundleId] = (appMap[event.appName || event.bundleId] || 0) + (event.activeSeconds || 0);
        }

        const activityData = {
            totalSeconds: totalActive,
            productiveSeconds: 0,
            distractingSeconds: 0,
            domainMap: appMap
        };

        await webActivityService.syncActivity(userId, {
            ...activityData,
            syncId: `sync-${Date.now()}`,
            date: timestamp,
        });

        // Track session-level activity
        await enrichmentService.trackSessionActivity(userId, activityData);

        logger.info(`CaptureService: Passive app activity funneled [User: ${userId}, Source: ${source}]`);
    }

    private async resolveIntelligence(userId: string, metadata: any): Promise<{ mentionIds: string[], tagIds: string[] }> {
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
}

export const captureService: ICaptureService = new CaptureService();
