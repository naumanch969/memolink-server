import { z } from 'zod';

export const WhatsAppMessageSchema = z.object({
    from: z.string(),
    id: z.string(),
    timestamp: z.string(),
    type: z.enum(['text', 'image', 'audio', 'video', 'document', 'sticker', 'unknown']),
    text: z.object({ body: z.string() }).optional(),
    audio: z.object({
        id: z.string(),
        mime_type: z.string(),
    }).optional(),
});

export const WhatsAppWebhookSchema = z.object({
    object: z.literal('whatsapp_business_account'),
    entry: z.array(z.object({
        id: z.string(),
        changes: z.array(z.object({
            value: z.object({
                messaging_product: z.literal('whatsapp'),
                metadata: z.object({
                    display_phone_number: z.string(),
                    phone_number_id: z.string(),
                }),
                messages: z.array(WhatsAppMessageSchema).optional(),
            }),
            field: z.literal('messages'),
        })),
    })),
});

export const WhatsAppConfigSchema = z.object({
    apiToken: z.string().min(1, 'WHATSAPP_API_TOKEN is required'),
    phoneNumberId: z.string().min(1, 'WHATSAPP_PHONE_NUMBER_ID is required'),
    verifyToken: z.string().min(1, 'WHATSAPP_VERIFY_TOKEN is required'),
});
