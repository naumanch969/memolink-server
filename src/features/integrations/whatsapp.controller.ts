import { Request, Response } from 'express';
import { config } from '../../config/env';
import { logger } from '../../config/logger';
import { ResponseHelper } from '../../core/utils/response.utils';
import { whatsappProvider } from './providers/whatsapp/whatsapp.provider';

export class WhatsAppController {

    // Meta Cloud API Webhook Verification
    static async verify(req: Request, res: Response): Promise<void> {
        const challenge = whatsappProvider.verifyWebhook(req.query as Record<string, string>);
        if (challenge) {
            res.status(200).send(challenge);
        } else {
            ResponseHelper.forbidden(res, 'Verification failed');
        }
    }

    // Incoming WhatsApp Messages
    static async receive(req: Request, res: Response): Promise<void> {
        try {
            logger.info('Received WhatsApp Webhook', { body: JSON.stringify(req.body, null, 2) });
            // Meta expects immediate 200 OK acknowledgment

            // 1. Structural Validation (Simple check as Meta requires 200 ok even on structural mismatch)
            const entry = req.body.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;
            const metadata = value?.metadata;

            if (metadata) {
                logger.info('WhatsApp Webhook Metadata', { phoneNumberId: metadata.phone_number_id, displayPhoneNumber: metadata.display_phone_number, wabaId: entry?.id });

                if (config.WHATSAPP_PHONE_NUMBER_ID && metadata.phone_number_id !== config.WHATSAPP_PHONE_NUMBER_ID) {
                    logger.warn('WhatsApp Phone Number ID mismatch', { expected: config.WHATSAPP_PHONE_NUMBER_ID, received: metadata.phone_number_id });
                }
            }

            if (!value || value.messaging_product !== 'whatsapp') {
                logger.warn('Invalid WhatsApp webhook payload structure or non-whatsapp product', { messaging_product: value?.messaging_product, hasValue: !!value });
                // We still return 200 to WhatsApp to avoid retries on bad payloads
                ResponseHelper.success(res, null, 'EVENT_RECEIVED');
                return;
            }

            // 2. Background Processing
            whatsappProvider.handleWebhook(req.body).catch(err => {
                logger.error('Error handling WhatsApp webhook', err);
            });

            // 3. Immediate Acknowledgment
            ResponseHelper.success(res, null, 'EVENT_RECEIVED');

        } catch (error) {
            logger.error('WhatsApp webhook processing error', error);
        }
    }
}
