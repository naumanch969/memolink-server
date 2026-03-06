import { CreateEntryRequest } from '../entry/entry.types';
import { ActivitySyncBatch } from '../web-activity/web-activity.types';

export interface WhatsAppPayload {
    from: string;
    body: string;
    senderName?: string;
    isVoice?: boolean;
    mediaUrl?: string;
    timestamp?: number;
}

export interface MobileActivityPayload {
    bundleId: string;
    appName: string;
    activeSeconds: number;
    interactionCount?: number;
    timestamp?: string;
}

export interface ICaptureService {
    captureEntry(userId: string, payload: CreateEntryRequest & { _id?: string }): Promise<any>;
    captureWeb(userId: string, payload: ActivitySyncBatch): Promise<void>;
    captureWhatsApp(userId: string, payload: WhatsAppPayload): Promise<void>;
    captureAppActivity(userId: string, source: 'mobile-app' | 'desktop-app', payload: MobileActivityPayload | MobileActivityPayload[]): Promise<void>;
}
