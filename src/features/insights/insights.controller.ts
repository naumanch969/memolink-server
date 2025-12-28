
import { Request, Response, NextFunction } from 'express';
import { InsightsService } from './insights.service';
import { InsightType } from './insights.interfaces';
import { AuthenticatedRequest } from '../../shared/types';

export class InsightsController {
    static async getDashboard(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as AuthenticatedRequest).user!._id.toString();

            // Parallel fetch
            const [streak, weekly, patterns] = await Promise.all([
                InsightsService.getStreak(userId),
                InsightsService.getRecentInsights(userId, InsightType.WEEKLY),
                InsightsService.getPatterns(userId)
            ]);

            // If no weekly insight exists (new user or cron hasn't run), generate on the fly for now
            let activeWeekly = weekly;
            if (!activeWeekly) {
                activeWeekly = await InsightsService.generateReport(userId, InsightType.WEEKLY);
            }

            res.json({
                streak,
                weekly: activeWeekly,
                patterns
            });
        } catch (error) {
            next(error);
        }
    }

    static async generate(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as AuthenticatedRequest).user!._id.toString();
            const { type } = req.query; // 'weekly' or 'monthly'

            if (type !== 'weekly' && type !== 'monthly') {
                res.status(400).json({ message: 'Invalid type' });
                return;
            }

            const report = await InsightsService.generateReport(userId, type as InsightType);
            res.json(report);
        } catch (error) {
            next(error);
        }
    }
}
