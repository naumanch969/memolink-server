import { Response } from 'express';
import { logger } from '../../config/logger';
import { ResponseHelper } from '../../core/utils/response.util';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { moodService } from './mood.service';

export class MoodController {
    // Upsert mood for a specific date
    static async upsert(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const mood = await moodService.upsertMood(userId, req.body);
            ResponseHelper.success(res, mood, 'Mood updated successfully');
        } catch (error) {
            logger.error('Upsert mood controller failed:', error);
            ResponseHelper.error(res, 'Failed to save mood', 500, error);
        }
    }

    // List moods with optional date range filter
    static async list(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const moods = await moodService.getMoods(userId, req.query);
            ResponseHelper.success(res, moods, 'Moods retrieved successfully');
        } catch (error) {
            logger.error('List moods controller failed:', error);
            ResponseHelper.error(res, 'Failed to fetch moods', 500, error);
        }
    }

    // Delete mood for a specific date
    static async delete(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { date } = req.body;
            if (!date) {
                return ResponseHelper.badRequest(res, 'Date is required for deletion');
            }
            await moodService.deleteMood(userId, new Date(date));
            ResponseHelper.success(res, null, 'Mood deleted successfully');
        } catch (error) {
            logger.error('Delete mood controller failed:', error);
            ResponseHelper.error(res, 'Failed to delete mood', 500, error);
        }
    }
}
