
import cron from 'node-cron';
import { logger } from '../config/logger';
import { User } from '../features/auth/auth.model';
import { InsightsService } from '../features/insights/insights.service';
import { InsightType } from '../features/insights/insights.interfaces';

export const initCronJobs = () => {
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
