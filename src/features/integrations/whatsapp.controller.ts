import { Request, Response } from 'express';
import { logger } from '../../config/logger';
import { ResponseHelper } from '../../core/utils/response.utils';
import { whatsappProvider } from './providers/whatsapp/whatsapp.provider';
import { WhatsAppWebhookSchema } from './providers/whatsapp/whatsapp.schema';

export class WhatsAppController {
    // Note: static classes in TS can't technically 'implement' an interface with instance methods, 
    // but we ensure the signature matches or turn it into a singleton if required.
    // Given the project uses static methods for controllers, we'll keep them static for now.
    /**
     * GET /integrations/whatsapp/webhook
     * Meta Cloud API Webhook Verification
     */
    static async verify(req: Request, res: Response): Promise<void> {
        const challenge = whatsappProvider.verifyWebhook(req.query);
        if (challenge) {
            res.status(200).send(challenge);
        } else {
            ResponseHelper.forbidden(res, 'Verification failed');
        }
    }

    /**
     * POST /integrations/whatsapp/webhook
     * Incoming WhatsApp Messages
     */
    static async receive(req: Request, res: Response): Promise<void> {
        try {
            logger.info('Received WhatsApp Webhook', { body: JSON.stringify(req.body, null, 2) });
            // Meta expects immediate 200 OK acknowledgment
            // 1. Zod Validation
            const validation = await WhatsAppWebhookSchema.safeParseAsync(req.body);

            if (!validation.success) {
                logger.warn('Invalid WhatsApp webhook payload', { errors: validation.error.format() });
                // We still return 200 to WhatsApp to avoid retries on bad payloads
                res.status(200).send('EVENT_RECEIVED');
                return;
            }

            // 2. Immediate Acknowledgment
            res.status(200).send('EVENT_RECEIVED');

            // 3. Background Processing
            whatsappProvider.handleWebhook(validation.data as any).catch(err => {
                logger.error('Error handling WhatsApp webhook', err);
            });
        } catch (error) {
            logger.error('WhatsApp webhook processing error', error);
            if (!res.headersSent) {
                res.status(200).send('EVENT_RECEIVED');
            }
        }
    }
}
