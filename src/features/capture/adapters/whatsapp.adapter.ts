import { CaptureSource, WhatsAppPayload } from '../capture.interfaces';
import { BaseCaptureAdapter, NormalizedCapture } from './base.adapter';

export class WhatsAppAdapter extends BaseCaptureAdapter<WhatsAppPayload> {
    readonly source: CaptureSource = 'whatsapp';

    /**
     * Normalizes raw WhatsApp message webhook data into the Active Intake schema.
     */
    async normalize(_userId: string, data: WhatsAppPayload): Promise<NormalizedCapture> {
        return {
            sourceType: 'active',
            inputMethod: 'whatsapp',
            payload: {
                rawText: data.body,
                metadata: {
                    whatsapp_from: data.from,
                    whatsapp_name: data.senderName,
                    whatsapp_media: data.mediaUrl,
                    isVoice: data.isVoice
                }
            },
            timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
        };
    }
}

export const whatsappAdapter = new WhatsAppAdapter();
