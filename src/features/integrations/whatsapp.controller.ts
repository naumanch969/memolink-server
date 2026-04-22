import { Request, Response } from 'express';
import { config } from '../../config/env';
import { logger } from '../../config/logger';
import { CacheKeys } from '../../core/cache/cache.keys';
import { cacheService } from '../../core/cache/cache.service';
import { ResponseHelper } from '../../core/utils/response.utils';
import { User } from '../auth/auth.model';
import { whatsappProvider } from './providers/whatsapp/whatsapp.provider';

export class WhatsAppController {

    // Meta Cloud API Webhook Verification
    static async verify(req: Request, res: Response): Promise<void> {
        const challenge = whatsappProvider.verifyWebhook(req.query);
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
                logger.info('WhatsApp Webhook Metadata', { 
                    phoneNumberId: metadata.phone_number_id,
                    displayPhoneNumber: metadata.display_phone_number,
                    wabaId: entry?.id
                });

                if (config.WHATSAPP_PHONE_NUMBER_ID && metadata.phone_number_id !== config.WHATSAPP_PHONE_NUMBER_ID) {
                    logger.warn('WhatsApp Phone Number ID mismatch', { 
                        expected: config.WHATSAPP_PHONE_NUMBER_ID, 
                        received: metadata.phone_number_id 
                    });
                }
            }

            if (!value || value.messaging_product !== 'whatsapp') {
                logger.warn('Invalid WhatsApp webhook payload structure or non-whatsapp product', { 
                    messaging_product: value?.messaging_product,
                    hasValue: !!value 
                });
                // We still return 200 to WhatsApp to avoid retries on bad payloads
                ResponseHelper.success(res, null, 'EVENT_RECEIVED');
                return;
            }

            // 2. Immediate Acknowledgment
            ResponseHelper.success(res, null, 'EVENT_RECEIVED');

            // 3. Background Processing
            whatsappProvider.handleWebhook(req.body).catch(err => {
                logger.error('Error handling WhatsApp webhook', err);
            });
        } catch (error) {
            logger.error('WhatsApp webhook processing error', error);
            if (!res.headersSent) {
                ResponseHelper.success(res, null, 'EVENT_RECEIVED');
            }
        }
    }

    // Generate a code for linking WhatsApp
    static async getLinkCode(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?._id;

            // Generate 6-digit code
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

            await User.findByIdAndUpdate(userId, {
                whatsappLinkingCode: code,
                whatsappLinkingCodeExpires: expiresAt
            });

            const phoneNumber = config.WHATSAPP_DISPLAY_NUMBER.replace(/\D/g, ''); // remove everything thats not a number/digit
            const link = `https://api.whatsapp.com/send?phone=${phoneNumber}&text=Verify%20${code}`;
            logger.info('Generated WhatsApp link', { link });

            ResponseHelper.success(res, { code, expiresAt, link }, 'Linking code generated');
        } catch (error) {
            logger.error('Error generating WhatsApp link code', error);
            ResponseHelper.error(res, 'Failed to generate linking code');
        }
    }

    // Disconnect WhatsApp
    static async disconnect(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user?._id;
            if (!userId) {
                ResponseHelper.unauthorized(res, 'User not found');
                return;
            }

            await User.findByIdAndUpdate(userId, {
                $unset: {
                    whatsappNumber: 1,
                    whatsappLinkingCode: 1,
                    whatsappLinkingCodeExpires: 1
                }
            });

            // Invalidate profile cache
            await cacheService.del(CacheKeys.userProfile(userId.toString()));
            // TODO: should we also delete preferences and storage?

            ResponseHelper.success(res, null, 'WhatsApp disconnected');
        } catch (error) {
            logger.error('Error disconnecting WhatsApp', error);
            ResponseHelper.error(res, 'Failed to disconnect WhatsApp');
        }
    }
}
