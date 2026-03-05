import { CreateEntryRequest } from '../entry/entry.types';
import { ActivitySyncBatch } from '../web-activity/web-activity.types';
import { NormalizedCapture } from './adapters/base.adapter';

export type CaptureSource =
    | 'active-entry'
    | 'web-extension'
    | 'whatsapp'
    | 'mobile-app'
    | 'desktop-app';

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

export type CapturePayload =
    | (CreateEntryRequest & { _id?: string })
    | ActivitySyncBatch
    | WhatsAppPayload
    | MobileActivityPayload
    | Record<string, unknown>;

export interface ICaptureService {
    ingest(userId: string, source: CaptureSource, payload: any): Promise<void>;

    // Legacy support (to be deprecated)
    ingestEntry(userId: string, payload: CreateEntryRequest & { _id?: string }): Promise<void>;
    ingestWeb(userId: string, payload: ActivitySyncBatch): Promise<void>;
    ingestWhatsApp(userId: string, payload: WhatsAppPayload): Promise<void>;
    ingestAppActivity(userId: string, source: 'mobile-app' | 'desktop-app', payload: MobileActivityPayload | MobileActivityPayload[]): Promise<void>;
}

export interface ICaptureAdapter<TRaw = any> {
    readonly source: CaptureSource;
    normalize(userId: string, payload: TRaw): Promise<NormalizedCapture | NormalizedCapture[]>;
}
