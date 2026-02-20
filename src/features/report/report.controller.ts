import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.util';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { reportService } from './report.service';

export class ReportController {
    /**
     * Get report history
     */
    static async getReports(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const result = await reportService.listReports(userId, req.query as any);
            ResponseHelper.paginated(res, result.reports, {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: Math.ceil(result.total / result.limit)
            }, 'Reports retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve reports', 500, error);
        }
    }

    /**
     * Get a specific report
     */
    static async getReport(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const report = await reportService.getReportById(req.params.id, userId);
            ResponseHelper.success(res, report, 'Report retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve report', 500, error);
        }
    }

    /**
     * Get the latest reports
     */
    static async getLatest(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const results = await reportService.getLatestReports(userId);
            ResponseHelper.success(res, results, 'Latest reports retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve latest reports', 500, error);
        }
    }

    /**
     * Trigger a report generation on demand
     */
    static async generateOnDemand(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { type } = req.body;
            if (!type) {
                ResponseHelper.badRequest(res, 'Report type is required (WEEKLY or MONTHLY)');
                return;
            }
            const result = await reportService.generateOnDemand(userId, type);
            ResponseHelper.success(res, result, 'Report generation started');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to start report generation', 500, error);
        }
    }

    /**
     * Manually trigger a report creation from a task
     * Useful for testing or manual regeneration
     */
    static async createFromTask(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { taskId } = req.body;
            if (!taskId) {
                ResponseHelper.badRequest(res, 'Task ID is required');
                return;
            }
            const report = await reportService.createFromTask(userId, taskId);
            ResponseHelper.created(res, report, 'Report created successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to create report from task', 500, error);
        }
    }
}
