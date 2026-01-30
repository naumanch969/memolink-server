
import cron from 'node-cron';
import { logger } from '../config/logger';
import { agentAccountability } from '../features/agent/agent.accountability';
import { User } from '../features/auth/auth.model';
import { storageService } from '../features/media/storage.service';
import { initNotificationProcessor } from '../features/notification/notification.cron';

export const initCronJobs = () => {
    // Start Notification Processor
    initNotificationProcessor();

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

    // Note: Weekly and monthly insights are now computed on-demand via analytics endpoint
    // No need for pre-computation cron jobs

    logger.info('Cron jobs initialized');
};
