import cron from 'node-cron';
import { logger } from '../../config/logger';
import notificationDispatcher from './notification.dispatcher';
import { NotificationQueue } from './notification.model';
import { NotificationStatus, NotificationType } from './notification.types';

let isRunning = false;

// Process the specific batch of notifications
const processNotificationQueue = async () => {
    if (isRunning) return;
    isRunning = true;

    try {
        const now = new Date();

        // 1. Find pending notifications due now or in the past
        const batch = await NotificationQueue.find({
            status: NotificationStatus.PENDING,
            scheduledFor: { $lte: now }
        }).limit(50).populate('reminderId');

        if (batch.length === 0) {
            isRunning = false;
            return;
        }

        logger.info(`Processing ${batch.length} notifications...`);

        // 2. Process each item
        for (const item of batch) {
            try {
                const reminder: any = item.reminderId;

                if (!reminder) {
                    item.status = NotificationStatus.FAILED;
                    item.error = 'Reminder not found';
                    await item.save();
                    continue;
                }

                // Create Notification using Template
                await notificationDispatcher.dispatchFromTemplate(
                    item.userId.toString(),
                    NotificationType.REMINDER,
                    'REMINDER_DUE',
                    {
                        title: reminder.title,
                        description: reminder.description,
                        id: reminder._id.toString()
                    },
                    {
                        referenceId: reminder._id.toString(),
                        referenceModel: 'Reminder'
                    }
                );

                // Update Queue Item Status
                item.status = NotificationStatus.SENT;
                item.sentAt = new Date();
                item.attempts += 1;
                await item.save();

            } catch (err: any) {
                logger.error(`Failed to process notification queue item ${item._id}`, err);

                item.attempts += 1;
                item.error = err.message;

                if (item.attempts >= 5) {
                    item.status = NotificationStatus.FAILED;
                } else {
                    // Exponential backoff: retry in 1, 2, 4, 8 minutes
                    const backoffMinutes = Math.pow(2, item.attempts - 1);
                    item.scheduledFor = new Date(Date.now() + backoffMinutes * 60000);
                    item.status = NotificationStatus.PENDING;
                }

                await item.save();
            }
        }
    } catch (error) {
        logger.error('Error in Notification Processor:', error);
    } finally {
        isRunning = false;
    }
};

export const initNotificationProcessor = () => {
    logger.info('Initializing Notification Processor (Every Minute)...');
    // Run every minute
    cron.schedule('* * * * *', processNotificationQueue);
};
