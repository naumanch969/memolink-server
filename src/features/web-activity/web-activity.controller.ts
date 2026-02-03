import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { webActivityService } from './web-activity.service';

export class WebActivityController {
    /**
     * POST /api/activity/sync
     */
    static async sync(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const batch = req.body;

            if (!batch.date || typeof batch.totalSeconds !== 'number') {
                ResponseHelper.badRequest(res, 'Invalid activity batch data');
                return;
            }

            const activity = await webActivityService.syncActivity(userId, batch);
            ResponseHelper.success(res, activity, 'Activity synced successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error');
        }
    }

    /**
     * GET /api/activity/today
     */
    static async getToday(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const date = req.query.date as string || new Date().toISOString().split('T')[0];
            const activity = await webActivityService.getTodayStats(userId, date);

            ResponseHelper.success(res, activity, 'Activity retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error');
        }
    }
    
    /**
     * GET /api/activity/definitions
     */
    static async getDefinitions(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const definitions = await webActivityService.getDefinitions(userId);
            ResponseHelper.success(res, definitions, 'Definitions retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error');
        }
    }

    /**
     * POST /api/activity/definitions
     */
    static async updateDefinitions(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const definitions = await webActivityService.updateDefinitions(userId, req.body);
            ResponseHelper.success(res, definitions, 'Definitions updated successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error');
        }
    }
}
