import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from './analytics.service';
import { ResponseHelper } from '../../core/utils/response';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { AuthenticatedRequest } from '../../shared/types';
import { AnalyticsRequest } from './analytics.interfaces';

export class AnalyticsController {
  static getAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const options: AnalyticsRequest = req.query;
    const analytics = await AnalyticsService.getAnalytics(userId, options);
    
    ResponseHelper.success(res, analytics, 'Analytics retrieved successfully');
  });

  static getEntryAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const options: AnalyticsRequest = req.query;
    const analytics = await AnalyticsService.getEntryAnalytics(userId, options);
    
    ResponseHelper.success(res, analytics, 'Entry analytics retrieved successfully');
  });



  static getMediaAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const options: AnalyticsRequest = req.query;
    const analytics = await AnalyticsService.getMediaAnalytics(userId, options);
    
    ResponseHelper.success(res, analytics, 'Media analytics retrieved successfully');
  });
}

export default AnalyticsController;
