import { Response } from 'express';
import { storageService } from './storage.service';
import { ResponseHelper } from '../../core/utils/response';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { AuthenticatedRequest } from '../../shared/types';

export class StorageController {
  /**
   * Get user's storage statistics
   */
  static getStorageStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!._id.toString();
    const stats = await storageService.getStorageStats(userId);
    ResponseHelper.success(res, stats, 'Storage stats retrieved successfully');
  });

  /**
   * Get storage breakdown by media type
   */
  static getStorageBreakdown = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!._id.toString();
    const breakdown = await storageService.getStorageBreakdown(userId);
    ResponseHelper.success(res, breakdown, 'Storage breakdown retrieved successfully');
  });

  /**
   * Sync/recalculate storage usage
   */
  static syncStorage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!._id.toString();
    const newUsage = await storageService.syncStorageUsage(userId);
    ResponseHelper.success(res, { storageUsed: newUsage }, 'Storage synced successfully');
  });

  /**
   * Get orphaned media files
   */
  static getOrphanedMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!._id.toString();
    const orphans = await storageService.findOrphanedMedia(userId);
    ResponseHelper.success(res, orphans, 'Orphaned media retrieved successfully');
  });

  /**
   * Get cleanup suggestions
   */
  static getCleanupSuggestions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!._id.toString();
    const suggestions = await storageService.getCleanupSuggestions(userId);
    ResponseHelper.success(res, suggestions, 'Cleanup suggestions retrieved successfully');
  });
}
