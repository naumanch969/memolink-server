import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { storageService } from './storage.service';

export class StorageController {
  /**
   * Get user's storage statistics
   */
  static async getStorageStats(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const stats = await storageService.getStorageStats(userId);
      ResponseHelper.success(res, stats, 'Storage statistics retrieved');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve storage statistics', 500, error);
    }
  }

  /**
   * Get detailed storage breakdown by file type
   */
  static async getStorageBreakdown(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const breakdown = await storageService.getStorageBreakdown(userId);
      ResponseHelper.success(res, breakdown, 'Storage breakdown retrieved');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve storage breakdown', 500, error);
    }
  }

  /**
   * Recalculate and sync storage usage
   */
  static async syncStorage(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const actualUsage = await storageService.syncStorageUsage(userId);
      ResponseHelper.success(res, { actualUsage }, 'Storage usage synced successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to sync storage usage', 500, error);
    }
  }

  /**
   * Find orphaned media
   */
  static async getOrphanedMedia(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const orphans = await storageService.findOrphanedMedia(userId);
      ResponseHelper.success(res, orphans, 'Orphaned media retrieved');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve orphaned media', 500, error);
    }
  }

  /**
   * Get cleanup suggestions
   */
  static async getCleanupSuggestions(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const suggestions = await storageService.getCleanupSuggestions(userId);
      ResponseHelper.success(res, suggestions, 'Cleanup suggestions retrieved');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve cleanup suggestions', 500, error);
    }
  }

  /**
   * Cleanup deleted files (Empty Trash)
   * This is a placeholder for future implementation
   */
  static async emptyTrash(req: AuthenticatedRequest, res: Response) {
    try {
      // Placeholder
      ResponseHelper.success(res, { count: 0, spaceReclaimed: 0 }, 'Trash emptied');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to empty trash', 500, error);
    }
  }
}
