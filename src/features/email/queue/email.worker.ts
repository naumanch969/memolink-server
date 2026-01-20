import { Job } from 'bullmq';
import { logger } from '../../../config/logger';
import { EmailProvider } from '../../../core/email/EmailProvider';
import {
    getPasswordResetEmailTemplate,
    getSecurityAlertTemplate,
    getVerificationEmailTemplate,
    getWelcomeEmailTemplate
} from '../../../core/email/templates/auth.templates';
import { QueueService } from '../../../core/queue/QueueService';
import { EMAIL_QUEUE_NAME } from './email.queue';
import { EmailJob, GenericEmailJobData, PasswordResetEmailJobData, SecurityAlertEmailJobData, VerificationEmailJobData, WelcomeEmailJobData } from './email.types';

const emailProvider = EmailProvider.getInstance();

const processEmailJob = async (job: Job<EmailJob>) => {
    const { type, data } = job.data;

    logger.info(`Processing email job ${job.id} of type ${type} to ${data.to}`);

    try {
        let emailContent: { subject: string; html: string; text?: string } | null = null;

        switch (type) {
            case 'VERIFICATION': {
                const d = data as VerificationEmailJobData;
                emailContent = getVerificationEmailTemplate(d.name, d.otp);
                break;
            }
            case 'PASSWORD_RESET': {
                const d = data as PasswordResetEmailJobData;
                // Construct reset URL here or pass it fully? 
                // Logic in original file constructed it. Let's construct it here to keep template clean or assume passed. 
                // The type def has `frontendUrl` and `resetToken` separately.
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
                    subject: d.subject,
                    html: d.html,
                    text: d.text
                };
                break;
            }
            default:
                throw new Error(`Unknown email job type: ${type}`);
        }

        if (emailContent) {
            const success = await emailProvider.sendEmail({
                to: data.to,
                subject: emailContent.subject,
                html: emailContent.html,
                text: emailContent.text
            });

            if (!success) {
                throw new Error('EmailProvider returned false');
            }
        }
    } catch (error: any) {
        logger.error(`Failed to process email job ${job.id}: ${error.message}`);
        throw error; // Rethrow to trigger BullMQ retry
    }
};

export const initEmailWorker = () => {
    // Register the worker
    QueueService.registerWorker(EMAIL_QUEUE_NAME, processEmailJob, {
        concurrency: 5, // Process up to 5 emails concurrently
        limiter: {
            max: 10, // Max 10 emails
            duration: 1000, // per 1 second
        },
    });
};
