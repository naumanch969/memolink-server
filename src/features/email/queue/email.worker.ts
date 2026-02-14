import { Job } from 'bullmq';
import { logger } from '../../../config/logger';
import { EmailProvider } from '../../../core/email/email.provider';
import { getPasswordResetEmailTemplate, getSecurityAlertTemplate, getVerificationEmailTemplate, getWelcomeEmailTemplate } from '../../../core/email/templates/auth.templates';
import { QueueService } from '../../../core/queue/QueueService';
import { validateEmailOrThrow } from '../../../shared/email-validator';
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
            // Validate email before sending
            validateEmailOrThrow(data.to, `${type} email`);

            await emailProvider.sendEmail({
                to: data.to,
                subject: emailContent.subject,
                html: emailContent.html,
                text: emailContent.text
            });
        }
    } catch (error: any) {
        logger.error(`Failed to process email job ${job.id}: ${error.message}`);
        throw error; // Rethrow to trigger BullMQ retry
    }
};

export const initEmailWorker = () => {
    // Register the worker
    const worker = QueueService.registerWorker(EMAIL_QUEUE_NAME, processEmailJob, {
        concurrency: 5, // Process up to 5 emails concurrently
        limiter: {
            max: 10, // Max 10 emails
            duration: 1000, // per 1 second
        },
    });

    // Handle permanently failed jobs by moving to DLQ
    worker.on('failed', async (job, err) => {
        if (job && job.attemptsMade >= (job.opts.attempts || 5)) {
            logger.error(`Job ${job.id} permanently failed after ${job.attemptsMade} attempts. Moving to DLQ.`);

            try {
                const { getEmailDLQ } = await import('./email.queue');
                const dlq = getEmailDLQ();

                await dlq.add('failed-email', {
                    originalJobId: job.id,
                    originalJobName: job.name,
                    jobData: job.data,
                    error: {
                        message: err.message,
                        stack: err.stack,
                        name: err.name
                    },
                    attempts: job.attemptsMade,
                    failedAt: new Date().toISOString(),
                    processedOn: job.processedOn,
                    finishedOn: job.finishedOn
                });

                logger.info(`Job ${job.id} moved to DLQ successfully`);

                // Update announcement stats if this is an announcement email
                await updateAnnouncementStats(job.name, 'failed', err);
            } catch (dlqError: any) {
                logger.error(`Failed to move job ${job.id} to DLQ:`, dlqError);
            }
        }
    });

    // Track successful email sends for announcements
    worker.on('completed', async (job) => {
        if (job && job.name?.startsWith('announcement-')) {
            await updateAnnouncementStats(job.name, 'sent');
        }
    });
};

/**
 * Update announcement statistics when emails are sent or failed
 */
async function updateAnnouncementStats(jobName: string | undefined, status: 'sent' | 'failed', error?: any) {
    if (!jobName || !jobName.startsWith('announcement-')) {
        return;
    }

    try {
        // Extract announcement ID and user ID from job name: announcement-{announcementId}-{userId}
        const parts = jobName.split('-');
        if (parts.length < 3) return;

        const announcementId = parts[1];
        const userId = parts[2];

        // Import models dynamically to avoid circular dependencies
        const { Announcement, AnnouncementStatus } = await import('../../communication/announcement.model');
        const { AnnouncementDeliveryLog, DeliveryStatus } = await import('../../communication/announcement-delivery-log.model');

        // 1. Update the delivery log
        if (status === 'sent') {
            await AnnouncementDeliveryLog.findOneAndUpdate(
                { announcementId, userId },
                { status: DeliveryStatus.SENT, sentAt: new Date(), $inc: { attempts: 1 } }
            );
        } else if (status === 'failed') {
            await AnnouncementDeliveryLog.findOneAndUpdate(
                { announcementId, userId },
                {
                    status: DeliveryStatus.FAILED,
                    failedAt: new Date(),
                    $inc: { attempts: 1 },
                    error: {
                        message: error?.message || 'Unknown error',
                        code: error?.code,
                        stack: error?.stack
                    }
                }
            );
        }

        // 2. Update the announcement stats ATOMICALLY
        const statUpdate: any = {};
        if (status === 'sent') statUpdate['stats.sentCount'] = 1;
        if (status === 'failed') statUpdate['stats.failedCount'] = 1;

        // Atomic increment and get the latest doc
        let announcement = await Announcement.findByIdAndUpdate(
            announcementId,
            { $inc: statUpdate },
            { new: true }
        );

        if (!announcement) return;

        // 3. Recalculate progress based on fresh DB state
        const processed = announcement.stats.sentCount + announcement.stats.failedCount;
        const total = announcement.stats.queuedCount;
        const newProgress = total > 0 ? Math.round((processed / total) * 100) : 100;

        // Update progress and COMPLETED status if needed
        const statusUpdate: any = { 'stats.progress': newProgress };
        let isBecomingCompleted = false;

        if (newProgress === 100 && announcement.status !== AnnouncementStatus.COMPLETED) {
            statusUpdate.status = AnnouncementStatus.COMPLETED;
            isBecomingCompleted = true;
        }

        // Final update for progress and status
        announcement = await Announcement.findByIdAndUpdate(
            announcementId,
            { $set: statusUpdate },
            { new: true }
        );

        if (!announcement) return;

        // 4. Emit socket events
        const { socketService } = await import('../../../core/socket/socket.service');
        const { SocketEvents } = await import('../../../core/socket/socket.types');
        const { USER_ROLES } = await import('../../../shared/constants');

        socketService.emitToRole(USER_ROLES.ADMIN, SocketEvents.ANNOUNCEMENT_DISPATCH_PROGRESS, {
            announcementId: announcement._id,
            stats: announcement.stats
        });

        if (isBecomingCompleted) {
            socketService.emitToRole(USER_ROLES.ADMIN, SocketEvents.ANNOUNCEMENT_COMPLETED, announcement);
        }

        logger.debug(`Updated announcement ${announcementId} stats atomically:`, {
            sent: announcement.stats.sentCount,
            failed: announcement.stats.failedCount,
            progress: announcement.stats.progress,
            status: announcement.status
        });
    } catch (error: any) {
        logger.error('Failed to update announcement stats:', error);
    }
}
