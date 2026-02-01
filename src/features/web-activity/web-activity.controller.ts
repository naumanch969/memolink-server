import { Response } from 'express';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { ResponseHelper } from '../../core/utils/response';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { webActivityService } from './web-activity.service';

export class WebActivityController {
    /**
     * POST /api/activity/sync
     */
    sync = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user!._id.toString();
            const batch = req.body;

            if (!batch.date || typeof batch.totalSeconds !== 'number') {
                ResponseHelper.badRequest(res, 'Invalid activity batch data');
                return
            }

            const activity = await webActivityService.syncActivity(userId, batch);
            ResponseHelper.success(res, activity, 'Activity synced successfully');
            return
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error');
            return
        }
    });

    /**
     * GET /api/activity/today
     */
    getToday = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user!._id.toString();
            const date = req.query.date as string || new Date().toISOString().split('T')[0];
            const activity = await webActivityService.getTodayStats(userId, date);

            ResponseHelper.success(res, activity, 'Activity retrieved successfully');
            return
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error');
            return
        }
    });
}

export const webActivityController = new WebActivityController();
