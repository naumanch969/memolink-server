import cron from 'node-cron';
import { NotificationQueue } from '../reminder/reminder.model';
import { NotificationStatus } from '../reminder/reminder.types';
import notificationService from './notification.service';
import { NotificationType } from './notification.types';
import { logger } from '../../config/logger';

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

                // Create In-App Notification
                await notificationService.create({
                    userId: item.userId.toString(),
                    type: NotificationType.REMINDER,
                    title: `Reminder: ${reminder.title}`,
                    message: reminder.description || `Time for your reminder: ${reminder.title}`,
                    referenceId: reminder._id.toString(),
                    referenceModel: 'Reminder',
                    actionUrl: `/reminders?highlight=${reminder._id}`
                });

                // Update Queue Item Status
                item.status = NotificationStatus.SENT;
                item.sentAt = new Date();
                await item.save();

            } catch (err: any) {
                logger.error(`Failed to process notification queue item ${item._id}`, err);
                item.status = NotificationStatus.FAILED;
                item.error = err.message;
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
