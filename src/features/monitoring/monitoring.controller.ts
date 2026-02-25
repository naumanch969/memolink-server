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
}
