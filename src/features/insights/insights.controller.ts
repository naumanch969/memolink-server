
import { Request, Response, NextFunction } from 'express';
import { InsightsService } from './insights.service';
import { InsightType } from './insights.interfaces';
import { AuthenticatedRequest } from '../../shared/types';
import { ResponseHelper } from '../../core/utils/response';
import { asyncHandler } from '../../core/middleware/errorHandler';

export class InsightsController {
    static getDashboard = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();

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

        ResponseHelper.success(res, {
            streak,
            weekly: activeWeekly,
            patterns
        }, 'Insights dashboard retrieved successfully');
    });

    static generate = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const userId = req.user!._id.toString();
        const { type } = req.query; // 'weekly' or 'monthly'

        if (type !== 'weekly' && type !== 'monthly') {
            ResponseHelper.badRequest(res, 'Invalid type');
            return;
        }

        const report = await InsightsService.generateReport(userId, type as InsightType);
        ResponseHelper.success(res, report, 'Insight generated successfully');
    });
}
