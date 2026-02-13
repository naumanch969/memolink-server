import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { analyticsAdminService } from './analytics.admin.service';

export class AnalyticsAdminController {

    static async getAnalyticsUserGrowth(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const data = await analyticsAdminService.getUserGrowth();
            ResponseHelper.success(res, data, 'User growth analytics retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async getAnalyticsPlatform(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const data = await analyticsAdminService.getPlatformStats();
            ResponseHelper.success(res, data, 'Platform stats retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async getAnalyticsUserAccounts(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const data = await analyticsAdminService.getUserAccountStats();
            ResponseHelper.success(res, data, 'User account stats retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async getAnalyticsActiveUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const data = await analyticsAdminService.getActiveUserStats();
            ResponseHelper.success(res, data, 'Active user stats retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async getAnalyticsContentGrowth(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const data = await analyticsAdminService.getContentGrowth();
            ResponseHelper.success(res, data, 'Content growth analytics retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async getAnalyticsFeatureBreakdown(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const data = await analyticsAdminService.getFeatureUsageBreakdown();
            ResponseHelper.success(res, data, 'Feature breakdown analytics retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async getAnalyticsRetention(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const data = await analyticsAdminService.getRetentionStats();
            ResponseHelper.success(res, data, 'Retention analytics retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async getAnalyticsFeatures(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const data = await analyticsAdminService.getFeatureStats();
            ResponseHelper.success(res, data, 'Feature stats retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async getDashboardOverview(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const data = await analyticsAdminService.getDashboardStats();
            ResponseHelper.success(res, data, 'Dashboard overview retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }
}
