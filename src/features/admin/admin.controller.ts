import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.utils';
import { AuthenticatedRequest } from '../auth/auth.types';
import { adminConfigService } from './admin.config.service';
import { adminService } from './admin.service';


export class AdminController {

    static async getBackups(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const backups = await adminService.listBackups();
            ResponseHelper.success(res, backups, 'Backups retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async triggerBackup(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            await adminService.triggerBackup();
            ResponseHelper.success(res, null, 'Backup process initiated successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async getBackupRuns(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const runs = await adminService.getBackupRuns();
            ResponseHelper.success(res, runs, 'Backup runs retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async getSystemConfigs(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const configs = await adminConfigService.getAllConfigs();
            ResponseHelper.success(res, configs, 'System configurations retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async updateSystemConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
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
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }


}
