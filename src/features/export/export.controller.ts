import { Request, Response, NextFunction } from 'express';
import { exportService } from './export.service';
import { ResponseHelper } from '../../core/utils/response';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { AuthenticatedRequest } from '../../shared/types';
import { ExportRequest } from './export.interfaces';

export class ExportController {
  static exportData = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const options: ExportRequest = req.body;
    const result = await exportService.exportData(userId, options);

    ResponseHelper.success(res, result, 'Export generated successfully');
  });
}

export default ExportController;
