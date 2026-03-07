import { IEntry } from '../entry/entry.types';
import { ActivitySyncBatch } from '../web-activity/web-activity.types';

export interface WhatsAppPayload {
    from: string;
    body: string;
    senderName?: string;
    isVoice?: boolean;
    mediaUrl?: string;
    timestamp?: number;
}

export interface ICapturePayload {
    content?: string;
    type?: 'text' | 'media' | 'mixed' | 'voice';
    date?: string | Date;
    startDate?: string | Date;
    endDate?: string | Date;
    startTime?: string;
    endTime?: string;
    isMultiDay?: boolean;
    kind?: 'entry' | 'document' | 'note';
    isPrivate?: boolean;
    isPinned?: boolean;
    isImportant?: boolean;
    tags?: string[];
    mood?: string;
    media?: string[];
    collectionId?: string;
    title?: string;
    location?: string;
    metadata?: Record<string, any>;
    _id?: string; // Client reference ID
}

export interface ICaptureService {
    captureEntry(userId: string, payload: ICapturePayload): Promise<IEntry>;
    captureWeb(userId: string, payload: ActivitySyncBatch): Promise<void>;
    captureWhatsApp(userId: string, payload: WhatsAppPayload): Promise<void>;
}
