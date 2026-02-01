import { Request, Response } from 'express';
import { webActivityService } from './web-activity.service';

export class WebActivityController {
    /**
     * POST /api/activity/sync
     */
    async sync(req: Request, res: Response) {
        try {
            const userId = (req as any).user.id;
            const batch = req.body;

            if (!batch.date || typeof batch.totalSeconds !== 'number') {
                return res.status(400).json({ success: false, error: 'Invalid activity batch data' });
            }

            const activity = await webActivityService.syncActivity(userId, batch);

            res.json({
                success: true,
                data: activity
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * GET /api/activity/today
     */
    async getToday(req: Request, res: Response) {
        try {
            const userId = (req as any).user.id;
            const activity = await webActivityService.getTodayStats(userId);

            res.json({
                success: true,
                data: activity
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    }
}

export const webActivityController = new WebActivityController();
