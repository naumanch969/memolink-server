import { Job } from 'bullmq';
import { logger } from '../../../config/logger';
import { EmailProvider } from '../../../core/email/email.provider';
import { getPasswordResetEmailTemplate, getSecurityAlertTemplate, getVerificationEmailTemplate, getWelcomeEmailTemplate } from '../../../core/email/templates/auth.templates';
import { getWaitlistConfirmationEmailTemplate, getWaitlistAdminEmailTemplate } from '../../../core/email/templates/waitlist.templates';
import { getBadgeUnlockedEmailTemplate } from '../../../core/email/templates/badge.templates';
import { getWeeklyReportEmailTemplate, getMonthlyReportEmailTemplate } from '../../../core/email/templates/report.templates';
import { EMAIL_QUEUE_NAME, EMAIL_WORKER_CONFIG } from '../../../core/queue/queue.constants';
import { queueService } from '../../../core/queue/queue.service';
import { validateEmailOrThrow } from '../../../shared/email-validator';
import { getEmailDLQ } from './email.queue';
import { EmailJob, GenericEmailJobData, PasswordResetEmailJobData, SecurityAlertEmailJobData, VerificationEmailJobData, WelcomeEmailJobData, WaitlistConfirmationEmailJobData, WaitlistAdminAlertEmailJobData, BadgeUnlockedEmailJobData, TemplatedEmailJobData, WeeklyReportEmailJobData, MonthlyReportEmailJobData } from '../interfaces/email-job.interface';
import { EmailStatus } from '../interfaces/email-log.interface';
import { EmailLog } from '../models/email-log.model';
import { EmailTemplate } from '../models/email-template.model';

const emailProvider = EmailProvider.getInstance();

/**
 * Simple template renderer fallback if handlebars is not available
 */
const renderTemplate = (html: string, data: any): string => {
    let rendered = html;
    Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        rendered = rendered.replace(regex, data[key]);
    });
    return rendered;
};

const processEmailJob = async (job: Job<EmailJob>) => {
    const { type, data } = job.data;
    const logId = data.logId;

    logger.info(`Processing email job ${job.id} [${type}] for log ${logId} to ${data.to}`);

    const log = logId ? await EmailLog.findById(logId) : null;

    try {
        if (log) {
            log.status = EmailStatus.SENDING;
            log.attempts += 1;
            await log.save();
        }

        let emailContent: { subject: string; html: string; text?: string } | null = null;

        switch (type) {
            case 'TEMPLATED': {
                const d = data as TemplatedEmailJobData;
                const template = await EmailTemplate.findOne({ name: d.templateName });
                if (!template) throw new Error(`Template not found: ${d.templateName}`);
                
                emailContent = {
                    subject: renderTemplate(template.subject, d.templateData),
                    html: renderTemplate(template.htmlBody, d.templateData),
                    text: template.textBody ? renderTemplate(template.textBody, d.templateData) : undefined
                };
                break;
            }
            case 'VERIFICATION': {
                const d = data as VerificationEmailJobData;
                emailContent = getVerificationEmailTemplate(d.name, d.otp);
                break;
            }
            case 'PASSWORD_RESET': {
                const d = data as PasswordResetEmailJobData;
                const resetUrl = `${d.frontendUrl}/auth/reset-password?token=${d.resetToken}`;
                emailContent = getPasswordResetEmailTemplate(d.name, resetUrl);
                break;
            }
            case 'WELCOME': {
                const d = data as WelcomeEmailJobData;
                emailContent = getWelcomeEmailTemplate(d.name, d.frontendUrl);
                break;
            }
            case 'SECURITY_ALERT': {
                const d = data as SecurityAlertEmailJobData;
                emailContent = getSecurityAlertTemplate(d.name, d.wrongAnswer);
                break;
            }
            case 'GENERIC': {
                const d = data as GenericEmailJobData;
                emailContent = {
                    subject: d.subject || 'No Subject',
                    html: d.html,
                    text: d.text
                };
                break;
            }
            case 'WAITLIST_CONFIRMATION': {
                const d = data as WaitlistConfirmationEmailJobData;
                emailContent = getWaitlistConfirmationEmailTemplate(d.email);
                break;
            }
            case 'WAITLIST_ADMIN_ALERT': {
                const d = data as WaitlistAdminAlertEmailJobData;
                emailContent = getWaitlistAdminEmailTemplate(d.email);
                break;
            }
            case 'BADGE_UNLOCKED': {
                const d = data as BadgeUnlockedEmailJobData;
                emailContent = getBadgeUnlockedEmailTemplate(d.userName, d.badgeName, d.badgeDescription, d.badgeId, d.rarity);
                break;
            }
            case 'WEEKLY_REPORT': {
                const d = data as WeeklyReportEmailJobData;
                emailContent = getWeeklyReportEmailTemplate(d.reportContent, d.period, d.frontendUrl);
                break;
            }
            case 'MONTHLY_REPORT': {
                const d = data as MonthlyReportEmailJobData;
                emailContent = getMonthlyReportEmailTemplate(d.reportContent, d.period, d.frontendUrl);
                break;
            }
            default:
                throw new Error(`Unknown email job type: ${type}`);
        }

        if (emailContent) {
            validateEmailOrThrow(data.to, `${type} email`);

            const result = await emailProvider.sendEmail({
                to: data.to,
                subject: emailContent.subject,
                html: emailContent.html,
                text: emailContent.text
            });

            if (log) {
                log.status = EmailStatus.SENT;
                log.sentAt = new Date();
                log.providerMessageId = result.messageId;
                log.provider = result.provider as any;
                log.subject = emailContent.subject; // Update subject from template
                await log.save();
            }

            logger.info(`Email sent successfully: ${data.to}, MessageID: ${result.messageId}`);
        }
    } catch (error: any) {
        logger.error(`Failed to process email job ${job.id}: ${error.message}`);
        
        if (log) {
            log.status = EmailStatus.FAILED;
            log.lastError = {
                message: error.message,
                stack: error.stack,
                code: error.code
            };
            await log.save();
        }

        throw error;
    }
};

export const initEmailWorker = () => {
    const worker = queueService.registerWorker(EMAIL_QUEUE_NAME, processEmailJob, EMAIL_WORKER_CONFIG);

    worker.on('failed', async (job, err) => {
        if (job && job.attemptsMade >= (job.opts.attempts || 5)) {
            logger.error(`Job ${job.id} permanently failed after ${job.attemptsMade} attempts. Moving to DLQ.`);

            try {
                const dlq = getEmailDLQ();
                await dlq.add('failed-email', {
                    originalJobId: job.id,
                    jobData: job.data,
                    error: { message: err.message, stack: err.stack }
                });
            } catch (dlqError: any) {
                logger.error(`Failed to move job ${job.id} to DLQ:`, dlqError);
            }
        }
    });
};
