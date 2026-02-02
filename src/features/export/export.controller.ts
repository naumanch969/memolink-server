import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { ExportRequest } from './export.interfaces';
import { exportService } from './export.service';

export class ExportController {
  static async exportData(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const exportOptions: ExportRequest = req.body;

      // This method handles the response directly by streaming
      await exportService.exportData(userId, exportOptions, res);
    } catch (error) {
      // If headers already sent, we can't send a JSON error response
      if (!res.headersSent) {
        ResponseHelper.error(res, 'Failed to export data', 500, error);
      }
    }
  }
}
