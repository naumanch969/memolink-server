import { Request, Response } from 'express';
import { adminService } from './admin.service';
import { ResponseHelper } from '../../core/utils/response';
import { AuthenticatedRequest } from '../../shared/types';

export class AdminController {

    /**
     * Get list of available database backups
     */
    async getBackups(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const backups = await adminService.listBackups();
            ResponseHelper.success(res, backups, 'Backups retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    /**
     * Manually trigger a new backup
     */
    async triggerBackup(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            await adminService.triggerBackup();
            ResponseHelper.success(res, null, 'Backup process initiated successfully. Check GitHub Actions for status.');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }

    /**
     * Get recent backup workflow runs
     */
    async getBackupRuns(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const runs = await adminService.getBackupRuns();
            ResponseHelper.success(res, runs, 'Backup runs retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error);
        }
    }
}

export const adminController = new AdminController();
