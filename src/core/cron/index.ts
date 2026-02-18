
import cron from 'node-cron';
import { logger } from '../../config/logger';
import { agentAccountability } from '../../features/agent/agent.accountability';
import { agentService } from '../../features/agent/agent.service';
import { AgentTaskType } from '../../features/agent/agent.types';
import { User } from '../../features/auth/auth.model';
import { entryService } from '../../features/entry/entry.service';
import { storageService } from '../../features/media/storage.service';
import { initNotificationProcessor } from '../../features/notification/notification.cron';
import { notificationService } from '../../features/notification/notification.service';
import { initScheduleProcessor } from '../../features/schedule/schedule.processor';
import { WebActivity } from '../../features/web-activity/web-activity.model';
import DateManager from '../utils/date-manager.util';

export const initCronJobs = () => {

    // Start Notification Processors
    initNotificationProcessor();
    initScheduleProcessor();

    // Self-Healing Tagging (processing entries missed by ai): Every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
        logger.info('Running self-healing tagging cron job...');
        await entryService.selfHealEntries(20);
    });

    // Notification Cleanup: Daily at 4 AM
    cron.schedule('0 4 * * *', async () => {
        await notificationService.cleanupOldNotifications();
    });

    // Agent Accountability: Every 4 hours
    cron.schedule('0 */4 * * *', async () => {
        await agentAccountability.runAccountabilityLoop();
    });

    // Orphan Detection: Daily at 3 AM
    cron.schedule('0 3 * * *', async () => {
        logger.info('Running orphan media detection cron job...');
        try {
            const users = await User.find({}).select('_id');
            let totalOrphans = 0;

            for (const user of users) {
                try {
                    const orphans = await storageService.findOrphanedMedia(user._id.toString());
                    if (orphans.length > 0) {
                        totalOrphans += orphans.length;
                        logger.info(`Found ${orphans.length} orphaned media for user ${user._id}`);
                    }
                } catch (err) {
                    logger.error(`Failed to check orphans for user ${user._id}`, err);
                }
            }

            logger.info(`Orphan detection completed. Total orphans found: ${totalOrphans}`);
        } catch (error) {
            logger.error('Orphan detection cron job failed:', error);
        }
    });

    // Storage Sync: Weekly on Saturday at 4 AM
    cron.schedule('0 4 * * 6', async () => {
        logger.info('Running storage sync cron job...');
        try {
            const users = await User.find({}).select('_id');

            for (const user of users) {
                try {
                    await storageService.syncStorageUsage(user._id.toString());
                } catch (err) {
                    logger.error(`Failed to sync storage for user ${user._id}`, err);
                }
            }

            logger.info('Storage sync cron job completed.');
        } catch (error) {
            logger.error('Storage sync cron job failed:', error);
        }
    });

    // Web Activity Summarizer: Daily at 12:05 AM
    cron.schedule('5 0 * * *', async () => {
        logger.info('Running web activity summarizer cron job...');
        try {
            const dateStr = DateManager.getYesterdayDateKey();

            // Find unique users with activity yesterday who haven't been summarized
            const activities = await WebActivity.find({
                date: dateStr,
                summaryCreated: { $ne: true },
                totalSeconds: { $gt: 60 } // Only summarize if they spent at least a minute
            }).select('userId');

            for (const activity of activities) {
                try {
                    await agentService.createTask(activity.userId.toString(), AgentTaskType.WEB_ACTIVITY_SUMMARY, {
                        date: dateStr
                    });
                } catch (err) {
                    logger.error(`Failed to enqueue summary for user ${activity.userId}`, err);
                }
            }

            logger.info(`Enqueued ${activities.length} activity summary tasks.`);
        } catch (error) {
            logger.error('Web activity summarizer cron job failed:', error);
        }
    });

    // Note: Weekly and monthly insights are now computed on-demand via analytics endpoint
    // No need for pre-computation cron jobs

    logger.info('Cron jobs initialized');
};
