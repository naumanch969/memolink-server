import { Response } from 'express';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { webActivityService } from './web-activity.service';

export class WebActivityController {
    /**
     * POST /api/activity/sync
     */
    sync = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!._id.toString();
        const batch = req.body;

        if (!batch.date || typeof batch.totalSeconds !== 'number') {
            return res.status(400).json({ success: false, error: 'Invalid activity batch data' });
        }

        const activity = await webActivityService.syncActivity(userId, batch);

        res.json({
            success: true,
            data: activity
        });
    });

    /**
     * GET /api/activity/today
     */
    getToday = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!._id.toString();
        const date = req.query.date as string || new Date().toISOString().split('T')[0];
        const activity = await webActivityService.getTodayStats(userId, date);

        res.json({
            success: true,
            data: activity
        });
    });
}

export const webActivityController = new WebActivityController();
