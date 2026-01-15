
import cron from 'node-cron';
import { logger } from '../config/logger';
import { User } from '../features/auth/auth.model';
import { InsightsService } from '../features/insights/insights.service';
import { InsightType } from '../features/insights/insights.interfaces';
import { initNotificationProcessor } from '../features/notification/notification.cron';
import { storageService } from '../features/media/storage.service';

export const initCronJobs = () => {
    // Start Notification Processor
    initNotificationProcessor();

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

    // Weekly Summary: Every Sunday at 8 PM (20:00)
    cron.schedule('0 20 * * 0', async () => {
        logger.info('Running weekly summary cron job...');
        try {
            const users = await User.find({}); // processing all users might be heavy in prod, use cursor or queue
            for (const user of users) {
                try {
                    await InsightsService.generateReport(user._id.toString(), InsightType.WEEKLY);
                } catch (err) {
                    logger.error(`Failed to generate weekly report for user ${user._id}`, err);
                }
            }
            logger.info('Weekly summary cron job completed.');
        } catch (error) {
            logger.error('Weekly summary cron job failed:', error);
        }
    });

    // Monthly Summary: 1st of each month at 8 AM
    cron.schedule('0 8 1 * *', async () => {
        logger.info('Running monthly summary cron job...');
        try {
            const users = await User.find({});
            for (const user of users) {
                try {
                    await InsightsService.generateReport(user._id.toString(), InsightType.MONTHLY);
                } catch (err) {
                    logger.error(`Failed to generate monthly report for user ${user._id}`, err);
                }
            }
            logger.info('Monthly summary cron job completed.');
        } catch (error) {
            logger.error('Monthly summary cron job failed:', error);
        }
    });

    logger.info('Cron jobs initialized');
};
