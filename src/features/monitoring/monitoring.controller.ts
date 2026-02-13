import { Response } from 'express';
import { logViewerService } from '../../core/monitoring/log-viewer.service';
import { ResponseHelper } from '../../core/utils/response';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { monitoringService } from './monitoring.service';

export class MonitoringController {

    static async getSystemHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const health = await monitoringService.getSystemMetrics();
            ResponseHelper.success(res, health, 'System health retrieved successfully');
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
