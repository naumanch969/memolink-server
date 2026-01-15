import { User } from '../auth/auth.model';
import { Media } from './media.model';
import { STORAGE_LIMITS, MEDIA_TYPES } from '../../shared/constants';
import { logger } from '../../config/logger';

export interface StorageStats {
  used: number;
  quota: number;
  available: number;
  usagePercent: number;
  isWarning: boolean;
  isCritical: boolean;
  breakdown: {
    images: number;
    videos: number;
    documents: number;
    audio: number;
    archives: number;
    data: number;
    code: number;
    other: number;
  };
}

export interface OrphanMedia {
  _id: string;
  filename: string;
  size: number;
  type: string;
  createdAt: Date;
  url: string;
}

export interface CleanupSuggestion {
  type: 'large' | 'old' | 'duplicate' | 'orphan';
  mediaIds: string[];
  potentialSavings: number;
  description: string;
}

class StorageService {
  /**
   * Get storage usage statistics for a user
   */
  async getStorageStats(userId: string): Promise<StorageStats> {
    const user = await User.findById(userId).select('storageUsed storageQuota');
    if (!user) {
      throw new Error('User not found');
    }

    // Get breakdown by media type
    const breakdown = await this.getStorageBreakdown(userId);
    const totalUsed = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

    // Sync if there's a mismatch (self-healing)
    if (Math.abs(totalUsed - user.storageUsed) > 1024) {
      await this.syncStorageUsage(userId);
    }

    const usagePercent = user.storageQuota > 0 ? (user.storageUsed / user.storageQuota) * 100 : 0;

    return {
      used: user.storageUsed,
      quota: user.storageQuota,
      available: Math.max(0, user.storageQuota - user.storageUsed),
      usagePercent: Math.round(usagePercent * 100) / 100,
      isWarning: usagePercent >= STORAGE_LIMITS.WARNING_THRESHOLD * 100,
      isCritical: usagePercent >= STORAGE_LIMITS.CRITICAL_THRESHOLD * 100,
      breakdown,
    };
  }

  /**
   * Get storage breakdown by media type
   */
  async getStorageBreakdown(userId: string): Promise<StorageStats['breakdown']> {
    const aggregation = await Media.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: '$type',
          totalSize: { $sum: '$size' },
        },
      },
    ]);

    const breakdown: StorageStats['breakdown'] = {
      images: 0,
      videos: 0,
      documents: 0,
      audio: 0,
      archives: 0,
      data: 0,
      code: 0,
      other: 0,
    };

    for (const item of aggregation) {
      switch (item._id) {
        case MEDIA_TYPES.IMAGE:
          breakdown.images = item.totalSize;
          break;
        case MEDIA_TYPES.VIDEO:
          breakdown.videos = item.totalSize;
          break;
        case MEDIA_TYPES.DOCUMENT:
          breakdown.documents = item.totalSize;
          break;
        case MEDIA_TYPES.AUDIO:
          breakdown.audio = item.totalSize;
          break;
        case MEDIA_TYPES.ARCHIVE:
          breakdown.archives = item.totalSize;
          break;
        case MEDIA_TYPES.DATA:
          breakdown.data = item.totalSize;
          break;
        case MEDIA_TYPES.CODE:
          breakdown.code = item.totalSize;
          break;
        default:
          breakdown.other += item.totalSize;
      }
    }

    return breakdown;
  }

  /**
   * Check if user can upload a file of given size
   */
  async canUpload(userId: string, fileSize: number): Promise<{ allowed: boolean; reason?: string }> {
    const user = await User.findById(userId).select('storageUsed storageQuota');
    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    const newUsage = user.storageUsed + fileSize;
    const usagePercent = (newUsage / user.storageQuota) * 100;

    if (usagePercent >= 100) {
      return {
        allowed: false,
        reason: `Storage quota exceeded. You have ${this.formatBytes(user.storageQuota - user.storageUsed)} remaining.`,
      };
    }

    if (usagePercent >= STORAGE_LIMITS.CRITICAL_THRESHOLD * 100) {
      return {
        allowed: false,
        reason: `Storage almost full (${Math.round(usagePercent)}%). Please free up space before uploading.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Update user's storage usage after upload
   */
  async incrementUsage(userId: string, bytes: number): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $inc: { storageUsed: bytes },
    });
    logger.debug(`Storage incremented for user ${userId}: +${this.formatBytes(bytes)}`);
  }

  /**
   * Update user's storage usage after deletion
   */
  async decrementUsage(userId: string, bytes: number): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $inc: { storageUsed: -bytes },
    });
    logger.debug(`Storage decremented for user ${userId}: -${this.formatBytes(bytes)}`);
  }

  /**
   * Recalculate and sync storage usage from actual media
   */
  async syncStorageUsage(userId: string): Promise<number> {
    const result = await Media.aggregate([
      { $match: { userId: userId } },
      { $group: { _id: null, totalSize: { $sum: '$size' } } },
    ]);

    const actualUsage = result[0]?.totalSize || 0;

    await User.findByIdAndUpdate(userId, {
      storageUsed: actualUsage,
    });

    logger.info(`Storage synced for user ${userId}: ${this.formatBytes(actualUsage)}`);
    return actualUsage;
  }

  /**
   * Find orphaned media (not linked to any entry or folder)
   */
  async findOrphanedMedia(userId: string): Promise<OrphanMedia[]> {
    // Import Entry model dynamically to avoid circular deps
    const { Entry } = await import('../entry/entry.model');

    // Get all media IDs that are referenced in entries
    const entriesWithMedia = await Entry.find({ userId, media: { $exists: true, $ne: [] } }).select('media');
    const referencedMediaIds = new Set(
      entriesWithMedia.flatMap((e) => e.media.map((m: { toString: () => string }) => m.toString()))
    );

    // Find media not in any folder and not referenced in entries
    const orphans = await Media.find({
      userId,
      folderId: { $exists: false },
    }).select('_id filename size type createdAt url');

    // Filter to only truly orphaned media
    const orphanedMedia = orphans.filter((m) => !referencedMediaIds.has(m._id.toString()));

    return orphanedMedia.map((m) => ({
      _id: m._id.toString(),
      filename: m.filename,
      size: m.size,
      type: m.type,
      createdAt: m.createdAt,
      url: m.url,
    }));
  }

  /**
   * Get cleanup suggestions for a user
   */
  async getCleanupSuggestions(userId: string): Promise<CleanupSuggestion[]> {
    const suggestions: CleanupSuggestion[] = [];

    // 1. Find large files (> 50MB)
    const largeFiles = await Media.find({ userId, size: { $gt: 50 * 1024 * 1024 } })
      .select('_id size')
      .sort({ size: -1 })
      .limit(10);

    if (largeFiles.length > 0) {
      suggestions.push({
        type: 'large',
        mediaIds: largeFiles.map((m) => m._id.toString()),
        potentialSavings: largeFiles.reduce((sum, m) => sum + m.size, 0),
        description: `${largeFiles.length} large files (>50MB) found`,
      });
    }

    // 2. Find old files (> 1 year, not in any entry)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const { Entry } = await import('../entry/entry.model');
    const recentEntryMedia = await Entry.find({ userId }).select('media');
    const recentMediaIds = new Set(
      recentEntryMedia.flatMap((e) => e.media.map((m: { toString: () => string }) => m.toString()))
    );

    const oldFiles = await Media.find({
      userId,
      createdAt: { $lt: oneYearAgo },
    }).select('_id size');

    const oldUnusedFiles = oldFiles.filter((m) => !recentMediaIds.has(m._id.toString()));
    if (oldUnusedFiles.length > 0) {
      suggestions.push({
        type: 'old',
        mediaIds: oldUnusedFiles.map((m) => m._id.toString()),
        potentialSavings: oldUnusedFiles.reduce((sum, m) => sum + m.size, 0),
        description: `${oldUnusedFiles.length} old files (>1 year) not used in entries`,
      });
    }

    // 3. Find orphaned media
    const orphans = await this.findOrphanedMedia(userId);
    if (orphans.length > 0) {
      suggestions.push({
        type: 'orphan',
        mediaIds: orphans.map((m) => m._id),
        potentialSavings: orphans.reduce((sum, m) => sum + m.size, 0),
        description: `${orphans.length} orphaned files not linked to entries or folders`,
      });
    }

    // 4. Find potential duplicates (same size and type)
    const duplicates = await Media.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: { size: '$size', type: '$type' },
          count: { $sum: 1 },
          ids: { $push: '$_id' },
          totalSize: { $sum: '$size' },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]);

    if (duplicates.length > 0) {
      const allDuplicateIds = duplicates.flatMap((d) => d.ids.slice(1).map((id: { toString: () => string }) => id.toString())); // Keep first, suggest removing rest
      const savings = duplicates.reduce((sum, d) => sum + d.totalSize - d.totalSize / d.count, 0);

      suggestions.push({
        type: 'duplicate',
        mediaIds: allDuplicateIds,
        potentialSavings: savings,
        description: `${duplicates.length} potential duplicate file groups found`,
      });
    }

    return suggestions;
  }

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const storageService = new StorageService();
