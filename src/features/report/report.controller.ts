import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.utils';
import { AuthenticatedRequest } from '../auth/auth.types';
import { reportService } from './report.service';

export class ReportController {
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

    static async getReport(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const report = await reportService.getReportById(req.params.id, userId);
            ResponseHelper.success(res, report, 'Report retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve report', 500, error);
        }
    }

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
