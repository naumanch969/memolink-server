export interface WhatsAppWebhookPayload {
    object: string;
    entry: Array<{
        id: string;
        changes: Array<{
            value: {
                messaging_product: 'whatsapp';
                metadata: {
                    display_phone_number: string;
                    phone_number_id: string;
                };
                contacts?: Array<{
                    profile: { name: string };
                    wa_id: string;
                }>;
                messages?: Array<WhatsAppMessage>;
                statuses?: Array<any>;
            };
            field: 'messages';
        }>;
    }>;
}

export type WhatsAppMessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'unknown';

export interface WhatsAppMessage {
    from: string;
    id: string;
    timestamp: string;
    type: WhatsAppMessageType;
    text?: { body: string };
    audio?: {
        id: string;
        mime_type: string;
    };
    image?: {
        id: string;
        mime_type: string;
        caption?: string;
    };
    video?: {
        id: string;
        mime_type: string;
    };
}

export interface WhatsAppResponse {
    messaging_product: 'whatsapp';
    contacts: Array<{ input: string; wa_id: string }>;
    messages: Array<{ id: string }>;
}
