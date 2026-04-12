import { Request, Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.utils';
import { logger } from '../../config/logger';
import supportService from './support.service';

export class SupportController {
    static async sendFeedback(req: Request, res: Response) {
        try {
            const { name, email, subject, message, type } = req.body;

            await supportService.sendSupportRequest({ name, email, subject, message, type })

            logger.info(`Support feedback sent by ${name} (${email})`);
            ResponseHelper.success(res, null, 'Thank you for your feedback! Our team will get back to you soon.');
        } catch (error) {
            logger.error('Failed to send support feedback:', error);
            ResponseHelper.error(res, 'Failed to send feedback. Please try again later.', 500, error);
        }
    }
}
