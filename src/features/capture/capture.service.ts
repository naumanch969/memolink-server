import crypto from 'crypto';
import { logger } from '../../config/logger';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import DateUtil from '../../shared/utils/date.utils';
import { entryClassifier } from '../enrichment/enrichment.classifier';
import { enrichmentService } from '../enrichment/enrichment.service';
import { InputMethod } from '../enrichment/enrichment.types';
import entryService from '../entry/entry.service';
import { CreateEntryRequest, IEntry, EntryStatus, EntryType } from '../entry/entry.types';
import webActivityService from '../web-activity/web-activity.service';
import { ActivitySyncBatch } from '../web-activity/web-activity.types';
import { ICapturePayload, ICaptureService, WhatsAppPayload } from './capture.interfaces';

export class CaptureService implements ICaptureService {

    // 1. ACTIVE: Text/Voice/Manual Entry
    async captureEntry(userId: string, payload: ICapturePayload): Promise<IEntry> {

        const entryDate = payload.date ? new Date(payload.date) : new Date();
        const sessionId = DateUtil.getSessionId(entryDate);
        const content = payload.content || '';

        // Determine input method
        const isMediaOrVoice = payload.type === 'media' || payload.type === 'voice' || payload.metadata?.isVoice;
        const method = isMediaOrVoice ? InputMethod.VOICE : InputMethod.TEXT;
        const inputMethodValue = payload.metadata?.source === 'whatsapp' ? InputMethod.WHATSAPP : method;

        // Classify signal tier
        const { tier } = entryClassifier.classify(content, payload.isImportant ?? false, isMediaOrVoice); // noise, log, signal, deep_signal

        // Determine type dynamically (will also be handled by pre-save hook in model)
        let entryType = EntryType.TEXT;
        if (isMediaOrVoice || (payload.media && payload.media.length > 0)) {
            entryType = content.trim() ? EntryType.MIXED : EntryType.MEDIA;
        }

        // Create Entry synchronously
        const entryData: CreateEntryRequest = {
            content: content,
            status: EntryStatus.QUEUED,
            type: entryType,
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
            tags: payload.tags,
            media: payload.media,
            collectionId: payload.collectionId,
            title: payload.title,
            location: payload.location,
            mood: payload.mood,
            signalTier: tier,
            metadata: {
                ...payload.metadata,
                sessionId,
                referenceId: payload._id,
                originalType: payload.type
            }
        };

        const entry = await entryService.createEntry(userId, entryData);
        console.log('entry', entry)
        // Inform client immediately
        socketService.emitToUser(userId, SocketEvents.ENTRY_CREATED, { ...entry, signalTier: tier });

        // Queue enrichment asynchronously with tier information
        await enrichmentService.enqueueActiveEnrichment(userId, entry._id.toString(), sessionId, tier);

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
            domainMap: payload.domainMap || {},
            events: payload.events || []
        };

        // Sync daily activity
        await webActivityService.syncActivity(userId, activityData);

        // Trigger passive enrichment evaluation logic (WebActivity based)
        await enrichmentService.evaluatePassiveGate(userId, activityData.date);

        logger.info(`CaptureService: Passive web data funneled [User: ${userId}]`);
    }

    // 3. WhatsApp
    async captureWhatsApp(userId: string, payload: WhatsAppPayload): Promise<IEntry> {
        // WhatsApp enters as an active entry but from the bot
        const metadata = {
            whatsapp_from: payload.from,
            whatsapp_name: payload.senderName,
            whatsapp_media: payload.mediaUrl,
            isVoice: payload.isVoice, // TODO: resolve these boolean flags to enum. and also, trasnform that whatsap_from to whatsappFrom, same for others. and run migration. infact, define it in schema
            isImage: payload.isImage,
            isVideo: payload.isVideo,
            isDocument: payload.isDocument,
            source: 'whatsapp'
        };

        const isMedia = payload.isVoice || payload.isImage || payload.isVideo || payload.isDocument;

        const entryPayload: ICapturePayload = {
            content: payload.body || '',
            type: isMedia ? 'media' : 'text',
            date: payload.timestamp ? new Date(payload.timestamp) : new Date(),
            media: payload.mediaUrl ? [payload.mediaUrl] : [],
            metadata
        };

        const entry = await this.captureEntry(userId, entryPayload);
        return entry;
    }

}

export const captureService: ICaptureService = new CaptureService();
