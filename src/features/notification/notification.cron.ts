import mongoose from 'mongoose';
import cron from 'node-cron';
import { logger } from '../../config/logger';
import notificationDispatcher from './notification.dispatcher';
import { NotificationQueue } from './notification.model';
import { NotificationStatus, NotificationType } from './notification.types';

let isRunning = false;

// Process the specific batch of notifications
const processNotificationQueue = async () => {
    if (isRunning) return;

    // Safety check: Don't process if database isn't connected
    // 1 = connected
    if (mongoose.connection.readyState !== 1) {
        return;
    }

    isRunning = true;

    try {
        const now = new Date();

        // 1. Process items one by one or in small batches using atomic updates to 'claim' them
        // This prevents race conditions in multi-instance environments
        let processedCount = 0;
        const batchSize = 20;

        while (processedCount < batchSize) {
            const item = await NotificationQueue.findOneAndUpdate(
                {
                    status: NotificationStatus.PENDING,
                    scheduledFor: { $lte: now }
                },
                {
                    $set: { status: NotificationStatus.PROCESSING }
                },
                {
                    new: true,
                    sort: { scheduledFor: 1 }
                }
            ).populate('reminderId');

            if (!item) break;

            processedCount++;

            try {
                const reminder: any = item.reminderId;

                if (!reminder) {
                    item.status = NotificationStatus.FAILED;
                    item.error = 'Reminder not found';
                    await item.save();
                    continue;
                }

                // Create Notification using Template
                // Added eventId for idempotency in the dispatcher/service
                const eventId = `cron-notif-${item._id}`;

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
                        referenceModel: 'Reminder',
                        eventId
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

        if (processedCount > 0) {
            logger.info(`[NotificationCron] Processed ${processedCount} notifications.`);
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
