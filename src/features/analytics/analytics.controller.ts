import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.util';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { AnalyticsRequest } from './analytics.interfaces';
import { AnalyticsService } from './analytics.service';

export class AnalyticsController {
  static async getAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const options: AnalyticsRequest = req.query;
      const analytics = await AnalyticsService.getAnalytics(userId, options);

      // Include patterns and weekly summary (merged from insights)
      const [patterns, weeklySummary] = await Promise.all([
        AnalyticsService.getPatterns(userId),
        AnalyticsService.getWeeklySummary(userId)
      ]);

      const enrichedAnalytics = { ...analytics, patterns, weeklySummary };

      ResponseHelper.success(res, enrichedAnalytics, 'Analytics retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve analytics', 500, error);
    }
  }

  static async getEntryAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const options: AnalyticsRequest = req.query;
      const analytics = await AnalyticsService.getEntryAnalytics(userId, options);

      ResponseHelper.success(res, analytics, 'Entry analytics retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve entry analytics', 500, error);
    }
  }

  static async getMediaAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const options: AnalyticsRequest = req.query;
      const analytics = await AnalyticsService.getMediaAnalytics(userId, options);

      ResponseHelper.success(res, analytics, 'Media analytics retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve media analytics', 500, error);
    }
  }

  static async getGraphData(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const graphData = await AnalyticsService.getGraphData(userId);

      ResponseHelper.success(res, graphData, 'Graph data retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve graph data', 500, error);
    }
  }
}

export default AnalyticsController;
