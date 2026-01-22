import { Response } from 'express';
import { logViewerService } from '../../core/monitoring/log-viewer.service';
import { ResponseHelper } from '../../core/utils/response';
import { AuthenticatedRequest } from '../../shared/types';
import { adminAnalyticsService } from './admin.analytics.service';
import { adminConfigService } from './admin.config.service';
import { adminService } from './admin.service';
import { adminUserService } from './admin.users.service';
import { monitorService } from './monitor.service';


export class AdminController {

    // ==========================================
    // BACKUPS
    // ==========================================

    async getBackups(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const backups = await adminService.listBackups();
            ResponseHelper.success(res, backups, 'Backups retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    async triggerBackup(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            await adminService.triggerBackup();
            ResponseHelper.success(res, null, 'Backup process initiated successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    async getBackupRuns(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const runs = await adminService.getBackupRuns();
            ResponseHelper.success(res, runs, 'Backup runs retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    // ==========================================
    // MONITORING
    // ==========================================

    async getSystemHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const health = await monitorService.getSystemMetrics();
            ResponseHelper.success(res, health, 'System health retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    async getDatabaseStats(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const stats = await monitorService.getDatabaseStats();
            ResponseHelper.success(res, stats, 'Database stats retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    async getJobQueueStats(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const queues = await monitorService.getJobQueues();
            ResponseHelper.success(res, queues, 'Job queue stats retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    async getLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const logs = logViewerService.getLogs();
            ResponseHelper.success(res, logs, 'Logs retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    async clearLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            logViewerService.clear();
            ResponseHelper.success(res, null, 'Logs cleared successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    // ==========================================
    // ANALYTICS
    // ==========================================

    async getAnalyticsUserGrowth(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const data = await adminAnalyticsService.getUserGrowth();
            ResponseHelper.success(res, data, 'User growth analytics retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    async getAnalyticsPlatform(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const data = await adminAnalyticsService.getPlatformStats();
            ResponseHelper.success(res, data, 'Platform stats retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    async getAnalyticsUserAccounts(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const data = await adminAnalyticsService.getUserAccountStats();
            ResponseHelper.success(res, data, 'User account stats retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    async getAnalyticsActiveUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const data = await adminAnalyticsService.getActiveUserStats();
            ResponseHelper.success(res, data, 'Active user stats retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    async getAnalyticsFeatures(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const data = await adminAnalyticsService.getFeatureStats();
            ResponseHelper.success(res, data, 'Feature stats retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    async getDashboardOverview(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const data = await adminAnalyticsService.getDashboardStats();
            ResponseHelper.success(res, data, 'Dashboard overview retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    // ==========================================
    // USER MANAGEMENT
    // ==========================================

    async getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const search = req.query.search as string;
            const role = req.query.role as string;

            const result = await adminUserService.getUsers({ page, limit, search, role });
            ResponseHelper.paginated(res, result.users, {
                page: result.page,
                limit,
                total: result.total,
                totalPages: result.totalPages
            }, 'Users retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }


    async getUserDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const user = await adminUserService.getUserDetails(id);
            ResponseHelper.success(res, user, 'User details retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    async updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const updates = req.body;
            const user = await adminUserService.updateUser(id, updates);
            ResponseHelper.success(res, user, 'User updated successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    async deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const result = await adminUserService.deleteUser(id);
            ResponseHelper.success(res, result, 'User and all associated data deleted successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    async deactivateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const user = await adminUserService.deactivateUser(id);
            ResponseHelper.success(res, user, 'User account deactivated successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    async reactivateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const user = await adminUserService.reactivateUser(id);
            ResponseHelper.success(res, user, 'User account reactivated successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    // ==========================================
    // SYSTEM CONFIGURATION
    // ==========================================

    async getSystemConfigs(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const configs = await adminConfigService.getAllConfigs();
            ResponseHelper.success(res, configs, 'System configurations retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    async updateSystemConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { key } = req.params;
            const { value } = req.body;
            const adminId = req.user!._id.toString(); // AuthenticatedRequest guarantees user

            const config = await adminConfigService.updateConfig(key, value, adminId);
            if (!config) {
                throw new Error('Configuration not found');
            }
            ResponseHelper.success(res, config, 'Configuration updated successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }
}

export const adminController = new AdminController();
