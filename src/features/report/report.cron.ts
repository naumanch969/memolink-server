import cron from 'node-cron';
import { logger } from '../../config/logger';
import { AgentTaskType } from '../agent/agent.types';
import { reportService } from './report.service';

export const initReportCron = () => {
    // Weekly Analysis Trigger: Every Sunday at 11 PM
    cron.schedule('0 23 * * 0', async () => {
        logger.info('Running weekly analysis cron job (staggered)...');
        try {
            await reportService.triggerStaggeredReports(AgentTaskType.WEEKLY_ANALYSIS);
        } catch (err) {
            logger.error('Weekly analysis cron job failed', err);
        }
    });

    // Monthly Analysis Trigger: 1st of every month at 1 AM
    cron.schedule('0 1 1 * *', async () => {
        logger.info('Running monthly analysis cron job (staggered)...');
        try {
            await reportService.triggerStaggeredReports(AgentTaskType.MONTHLY_ANALYSIS);
        } catch (err) {
            logger.error('Monthly analysis cron job failed', err);
        }
    });

    logger.info('Report cron jobs initialized');
};
