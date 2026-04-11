import { Request, Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.utils';
import { getEmailQueue } from '../email/queue/email.queue';
import { logger } from '../../config/logger';

export class SupportController {
    static async sendFeedback(req: Request, res: Response) {
        try {
            const { name, email, subject, message, type } = req.body;
            
            const supportEmail = 'support.brinn@opstintechnologies.com';
            
            const html = `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #333; margin-bottom: 20px;">Support Request / Feedback</h2>
                    <p><strong>From:</strong> ${name} (${email})</p>
                    <p><strong>Type:</strong> ${type || 'General Feedback'}</p>
                    <p><strong>Subject:</strong> ${subject}</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="white-space: pre-wrap; line-height: 1.6; color: #555;">${message}</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #999;">This message was sent from the Brinn Feedback Modal.</p>
                </div>
            `;

            const emailQueue = getEmailQueue();
            await emailQueue.add('support-feedback', {
                type: 'GENERIC',
                data: {
                    to: supportEmail,
                    subject: `[FEEDBACK] ${subject} - from ${name}`,
                    html,
                    text: `Support request from ${name} (${email}):\n\n${message}`
                }
            });

            logger.info(`Support feedback sent by ${name} (${email})`);
            ResponseHelper.success(res, null, 'Thank you for your feedback! Our team will get back to you soon.');
        } catch (error) {
            logger.error('Failed to send support feedback:', error);
            ResponseHelper.error(res, 'Failed to send feedback. Please try again later.', 500, error);
        }
    }
}
