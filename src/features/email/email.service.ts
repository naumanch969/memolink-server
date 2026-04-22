import { getEmailQueue } from './queue/email.queue';
import { EmailLog } from './models/email-log.model';
import { EmailTemplate } from './models/email-template.model';
import { EmailStatus } from './interfaces/email-log.interface';
import { EmailJobType } from './interfaces/email-job.interface';
import { logger } from '../../config/logger';
import { validateEmailOrThrow } from '../../shared/email-validator';
import { Types } from 'mongoose';

export class EmailService {
    /**
     * Auth & Security Emails
     */
    async sendVerificationEmail(to: string, name: string, otp: string, userId?: string): Promise<string> {
        return this.sendSystemEmail('VERIFICATION', { to, name, otp }, userId);
    }

    async sendPasswordResetEmail(to: string, name: string, resetToken: string, frontendUrl: string, userId?: string): Promise<string> {
        return this.sendSystemEmail('PASSWORD_RESET', { to, name, resetToken, frontendUrl }, userId);
    }

    async sendWelcomeEmail(to: string, name: string, frontendUrl: string, userId?: string): Promise<string> {
        return this.sendSystemEmail('WELCOME', { to, name, frontendUrl }, userId);
    }

    async sendSecurityAlert(to: string, name: string, wrongAnswer: string, userId?: string): Promise<string> {
        return this.sendSystemEmail('SECURITY_ALERT', { to, name, wrongAnswer }, userId);
    }

    /**
     * Waitlist Emails
     */
    async sendWaitlistConfirmationEmail(to: string): Promise<string> {
        return this.sendSystemEmail('WAITLIST_CONFIRMATION', { to, email: to });
    }

    async sendWaitlistAdminAlert(email: string, adminEmail: string): Promise<string> {
        return this.sendSystemEmail('WAITLIST_ADMIN_ALERT', { to: adminEmail, email });
    }

    /**
     * Send a system-defined email (hardcoded template logic) via queue
     */
    async sendSystemEmail(type: EmailJobType, data: any, userId?: string, metadata?: Record<string, any>): Promise<string> {
        try {
            validateEmailOrThrow(data.to, `system email (${type})`);

            // 1. Create Log Entry
            const log = await EmailLog.create({
                userId: userId ? new Types.ObjectId(userId) : undefined,
                to: data.to,
                subject: 'Pending...', // Will be updated by worker or template
                templateId: type,
                templateData: data,
                status: EmailStatus.PENDING,
                attempts: 0,
                metadata
            });

            // 2. Add to Queue
            const emailQueue = getEmailQueue();
            await emailQueue.add(type.toLowerCase(), {
                type,
                data: {
                    ...data,
                    logId: log._id.toString()
                }
            });

            // 3. Update log to QUEUED
            log.status = EmailStatus.QUEUED;
            await log.save();

            logger.info(`Email [${type}] queued for ${data.to}. LogID: ${log._id}`);
            return log._id.toString();
        } catch (error: any) {
            logger.error(`Failed to queue system email [${type}]:`, error);
            throw error;
        }
    }

    /**
     * Send a database-defined templated email via queue
     */
    async sendTemplatedEmail(templateName: string, to: string, templateData: any, userId?: string, metadata?: Record<string, any>): Promise<string> {
        try {
            validateEmailOrThrow(to, `templated email (${templateName})`);

            const template = await EmailTemplate.findOne({ name: templateName, isActive: true });
            if (!template) {
                throw new Error(`Active email template not found: ${templateName}`);
            }

            const log = await EmailLog.create({
                userId: userId ? new Types.ObjectId(userId) : undefined,
                to,
                subject: template.subject,
                templateId: templateName,
                templateData,
                status: EmailStatus.PENDING,
                metadata
            });

            const emailQueue = getEmailQueue();
            await emailQueue.add('templated-email', {
                type: 'TEMPLATED' as EmailJobType,
                data: {
                    to,
                    logId: log._id.toString(),
                    templateName,
                    templateData
                }
            });

            log.status = EmailStatus.QUEUED;
            await log.save();

            logger.info(`Templated email [${templateName}] queued for ${to}. LogID: ${log._id}`);
            return log._id.toString();
        } catch (error: any) {
            logger.error(`Failed to queue templated email [${templateName}]:`, error);
            throw error;
        }
    }

    /**
     * Send a one-off custom email
     */
    async sendCustomEmail(to: string, subject: string, html: string, text?: string, userId?: string, metadata?: Record<string, any>): Promise<string> {
        try {
            validateEmailOrThrow(to, 'custom email');

            const log = await EmailLog.create({
                userId: userId ? new Types.ObjectId(userId) : undefined,
                to,
                subject,
                templateId: 'CUSTOM',
                templateData: { html, text },
                status: EmailStatus.PENDING,
                metadata
            });

            const emailQueue = getEmailQueue();
            await emailQueue.add('custom-email', {
                type: 'GENERIC' as EmailJobType,
                data: {
                    to,
                    logId: log._id.toString(),
                    subject,
                    html,
                    text
                }
            });

            log.status = EmailStatus.QUEUED;
            await log.save();

            return log._id.toString();
        } catch (error: any) {
            logger.error('Failed to queue custom email:', error);
            throw error;
        }
    }

    /**
     * Send bulk emails for dispatches (e.g., announcements)
     */
    async sendBulkEmails(recipients: Array<{ to: string; userId?: string }>, subject: string, html: string, text?: string, metadata?: Record<string, any>): Promise<number> {
        try {
            const batchSize = 100;
            let queuedCount = 0;
            const emailQueue = getEmailQueue();

            for (let i = 0; i < recipients.length; i += batchSize) {
                const batch = recipients.slice(i, i + batchSize);
                const emailLogs: any[] = [];
                const queueJobs: any[] = [];

                for (const recipient of batch) {
                    try {
                        validateEmailOrThrow(recipient.to, 'bulk email');

                        const log = new EmailLog({
                            userId: recipient.userId ? new Types.ObjectId(recipient.userId) : undefined,
                            to: recipient.to,
                            subject,
                            templateId: 'BULK',
                            templateData: { html, text },
                            status: EmailStatus.QUEUED,
                            metadata
                        });

                        emailLogs.push(log);
                        queueJobs.push({
                            name: 'bulk-email',
                            data: {
                                type: 'GENERIC',
                                data: {
                                    to: recipient.to,
                                    logId: log._id.toString(),
                                    subject,
                                    html,
                                    text
                                }
                            }
                        });
                    } catch (err) {
                        logger.warn(`Skipping invalid bulk recipient: ${recipient.to}`);
                    }
                }

                if (emailLogs.length > 0) {
                    await EmailLog.insertMany(emailLogs);
                    await emailQueue.addBulk(queueJobs);
                    queuedCount += emailLogs.length;
                }
            }

            return queuedCount;
        } catch (error: any) {
            logger.error('Failed to send bulk emails:', error);
            throw error;
        }
    }

    /**
     * Get email logs with filters
     */
    async getLogs(page = 1, limit = 20, filter: any = {}) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            EmailLog.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            EmailLog.countDocuments(filter)
        ]);
        return { data, total, page, limit };
    }

    /**
     * Get logs by metadata key/value
     */
    async getLogsByMetadata(key: string, value: any, page = 1, limit = 50) {
        const filter = { [`metadata.${key}`]: value };
        return this.getLogs(page, limit, filter);
    }
}

export const emailService = new EmailService();
