import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.utils';
import { AuthenticatedRequest } from '../auth/auth.types';
import { logViewerService } from './log-viewer.service';
import { monitoringService } from './monitoring.service';

export class MonitoringController {

    static async getSystemHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const health = await monitoringService.getFullHealth();
            const status = health.status === 'healthy' ? 200 : 503;
            ResponseHelper.success(res, health, 'System health retrieved successfully', status);
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async getDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const data = await monitoringService.getDashboardMetrics();
            ResponseHelper.success(res, data, 'Dashboard metrics retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async getDatabaseStats(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const stats = await monitoringService.getDatabaseStats();
            ResponseHelper.success(res, stats, 'Database stats retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async getJobQueueStats(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const queues = await monitoringService.getJobQueues();
            ResponseHelper.success(res, queues, 'Job queue stats retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async getInfrastructureStats(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const stats = await monitoringService.getInfrastructureMetrics();
            ResponseHelper.success(res, stats, 'Infrastructure stats retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async getLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const logs = logViewerService.getLogs();
            ResponseHelper.success(res, logs, 'Logs retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async clearLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            logViewerService.clear();
            ResponseHelper.success(res, null, 'Logs cleared successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async getJobList(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { queueName } = req.params;
            const statusParam = (req.query.status as string) || '';
            const page = Math.max(1, parseInt(req.query.page as string) || 1);
            const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
            const statuses = statusParam ? statusParam.split(',').map(s => s.trim()) : [];

            const jobs = await monitoringService.getJobList(queueName, statuses, page, limit);
            ResponseHelper.success(res, jobs, 'Job list retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async retryJob(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { queueName, jobId } = req.params;
            await monitoringService.retryJob(queueName, jobId);
            ResponseHelper.success(res, null, `Job ${jobId} re-queued successfully`);
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async removeJob(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { queueName, jobId } = req.params;
            await monitoringService.removeJob(queueName, jobId);
            ResponseHelper.success(res, null, `Job ${jobId} removed successfully`);
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }
}
