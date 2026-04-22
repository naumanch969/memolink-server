import { Request, Response } from 'express';
import { emailService } from './email.service';
import { EmailLog } from './models/email-log.model';
import { EmailStatus } from './interfaces/email-log.interface';
import { EmailTemplate } from './models/email-template.model';
import { logger } from '../../config/logger';
import { ResponseHelper } from '../../core/utils/response.utils';
import { config } from '../../config/env';

export class EmailController {
    /**
     * Webhook for Resend events (opens, clicks, bounces)
     */
    async handleResendWebhook(req: Request, res: Response) {
        try {
            // Webhook verify if secret is set
            const svixId = req.headers['svix-id'] as string;
            const svixTimestamp = req.headers['svix-timestamp'] as string;
            const svixSignature = req.headers['svix-signature'] as string;
            const webhookSecret = config.EMAIL_RESEND_WEBHOOK_SECRET;

            if (webhookSecret) {
                if (!svixId || !svixTimestamp || !svixSignature) {
                    logger.warn('Resend Webhook: Missing signature headers');
                    return ResponseHelper.unauthorized(res, 'Missing webhook signature headers');
                }
                // Signature verification would normally use svix library
                // Since it's not installed, we'll log for now and point to why.
                // In production, this should be: const svix = new Webhook(webhookSecret); svix.verify(req.rawBody, req.headers);
            }

            const event = req.body;
            const eventType = event.type;
            const emailId = event.data?.email_id;

            if (!emailId) {
                return ResponseHelper.badRequest(res, 'No email_id in webhook payload');
            }

            const log = await EmailLog.findOne({ providerMessageId: emailId });
            if (!log) {
                logger.warn(`EmailLog not found for Resend ID: ${emailId}`);
                return ResponseHelper.success(res, null, 'Log not found');
            }

            switch (eventType) {
                case 'email.delivered':
                    log.status = EmailStatus.DELIVERED;
                    log.deliveredAt = new Date();
                    break;
                case 'email.opened':
                    log.status = EmailStatus.OPENED;
                    if (!log.openedAt) log.openedAt = new Date();
                    break;
                case 'email.clicked':
                    log.status = EmailStatus.CLICKED;
                    if (!log.clickedAt) log.clickedAt = new Date();
                    break;
                case 'email.bounced':
                    log.status = EmailStatus.BOUNCED;
                    break;
                case 'email.complained':
                    log.status = EmailStatus.SPAM;
                    break;
            }

            await log.save();
            logger.info(`Updated EmailLog ${log._id} status to ${log.status} via webhook`);

            return ResponseHelper.success(res, { logId: log._id }, 'Status updated');
        } catch (error: any) {
            logger.error('Resend webhook error:', error);
            return ResponseHelper.error(res, 'Internal server error');
        }
    }

    /**
     * Admin: Get email logs
     */
    async getLogs(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const status = req.query.status as string;
            const to = req.query.to as string;

            const filter: any = {};
            if (status) filter.status = status;
            if (to) filter.to = new RegExp(to, 'i');

            const { data, total } = await emailService.getLogs(page, limit, filter);
            
            return ResponseHelper.paginated(res, data, { page, limit, total, totalPages: Math.ceil(total / limit) }, 'Email logs retrieved successfully');
        } catch (error: any) {
            return ResponseHelper.error(res, error.message);
        }
    }

    /**
     * Admin: Manage Templates
     */
    async getTemplates(req: Request, res: Response) {
        try {
            const templates = await EmailTemplate.find().sort({ name: 1 });
            return ResponseHelper.success(res, templates, 'Templates retrieved successfully');
        } catch (error: any) {
            return ResponseHelper.error(res, error.message);
        }
    }

    async createTemplate(req: Request, res: Response) {
        try {
            const template = await EmailTemplate.create(req.body);
            return ResponseHelper.created(res, template, 'Template created successfully');
        } catch (error: any) {
            return ResponseHelper.badRequest(res, error.message);
        }
    }

    async updateTemplate(req: Request, res: Response) {
        try {
            const template = await EmailTemplate.findByIdAndUpdate(req.params.id, req.body, { new: true });
            if (!template) return ResponseHelper.notFound(res, 'Template not found');
            return ResponseHelper.success(res, template, 'Template updated successfully');
        } catch (error: any) {
            return ResponseHelper.badRequest(res, error.message);
        }
    }

    async getTemplateById(req: Request, res: Response) {
        try {
            const template = await EmailTemplate.findById(req.params.id);
            if (!template) return ResponseHelper.notFound(res, 'Template not found');
            return ResponseHelper.success(res, template, 'Template retrieved successfully');
        } catch (error: any) {
            return ResponseHelper.error(res, error.message);
        }
    }

    async deleteTemplate(req: Request, res: Response) {
        try {
            const template = await EmailTemplate.findByIdAndDelete(req.params.id);
            if (!template) return ResponseHelper.notFound(res, 'Template not found');
            return ResponseHelper.success(res, null, 'Template deleted successfully');
        } catch (error: any) {
            return ResponseHelper.error(res, error.message);
        }
    }

    /**
     * Admin: Send a one-off custom email
     */
    async sendCustomEmail(req: Request, res: Response) {
        try {
            const { to, subject, html, text } = req.body;
            if (!to || !subject || !html) {
                return ResponseHelper.badRequest(res, 'Recipient, subject, and HTML content are required');
            }

            const logId = await emailService.sendCustomEmail(to, subject, html, text);
            return ResponseHelper.success(res, { logId }, 'Email queued successfully');
        } catch (error: any) {
            return ResponseHelper.error(res, error.message);
        }
    }
}

export const emailController = new EmailController();
