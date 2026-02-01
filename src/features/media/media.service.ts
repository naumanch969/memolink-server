import { Types } from 'mongoose';
import { CloudinaryService } from '../../config/cloudinary';
import { logger } from '../../config/logger';
import { createNotFoundError } from '../../core/middleware/errorHandler';
import { Helpers } from '../../shared/helpers';
import { mediaEvents, MediaEventType } from './media.events';
import { CreateMediaRequest, IMedia, IMediaService, UpdateMediaRequest } from './media.interfaces';
import { Media } from './media.model';
import { storageService } from './storage.service';

export class MediaService implements IMediaService {
  async createMedia(userId: string, mediaData: CreateMediaRequest): Promise<IMedia> {
    try {
      const media = new Media({
        userId: new Types.ObjectId(userId),
        ...mediaData,
      });

      await media.save();
      logger.info('Media created successfully', { mediaId: media._id, userId });
      return media;
    } catch (error) {
      logger.error('Media creation failed:', error);
      throw error;
    }
  }

  async updateMedia(mediaId: string, userId: string, updateData: UpdateMediaRequest): Promise<IMedia> {
    try {
      // Validate required parameters
      if (!mediaId || !userId) {
        throw new Error('Media ID and User ID are required');
      }

      const media = await Media.findOneAndUpdate(
        { _id: mediaId, userId },
        { $set: updateData },
        { new: true, runValidators: true }
      );
      if (!media) {
        throw createNotFoundError('Media');
      }
      return media;
    } catch (error) {
      logger.error('Media update failed:', error);
      throw error;
    }
  }

  async getMediaById(mediaId: string, userId: string): Promise<IMedia> {
    try {
      const media = await Media.findOne({ _id: mediaId, userId });
      if (!media) {
        throw createNotFoundError('Media');
      }
      return media;
    } catch (error) {
      logger.error('Get media by ID failed:', error);
      throw error;
    }
  }

  async getUserMedia(userId: string, options: {
    page?: number;
    limit?: number;
    sort?: string;
    type?: string;
    folderId?: string | null;
    search?: string;
  } = {}): Promise<{
    media: IMedia[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const { page, limit, skip } = Helpers.getPaginationParams(options);
      const sort = Helpers.getSortParams(options, 'createdAt');

      // Build filter query
      const filter: Record<string, unknown> = { userId };

      if (options.type) {
        filter.type = options.type;
      }

      if (options.folderId !== undefined) {
        // If folderId is null or 'null', get media without folder
        filter.folderId = options.folderId === 'null' ? null : options.folderId;
      }

      if (options.search) {
        filter.$or = [
          { originalName: { $regex: options.search, $options: 'i' } },
          { tags: { $in: [new RegExp(options.search, 'i')] } },
        ];
      }

      const [media, total] = await Promise.all([
        Media.find(filter).sort(sort as Record<string, 1 | -1>).skip(skip).limit(limit),
        Media.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limit);
      return { media, total, page, limit, totalPages };
    } catch (error) {
      logger.error('Get user media failed:', error);
      throw error;
    }
  }

  async deleteMedia(mediaId: string, userId: string): Promise<void> {
    try {
      const media = await Media.findOneAndDelete({ _id: mediaId, userId });
      if (!media) {
        throw createNotFoundError('Media');
      }

      // Delete from Cloudinary to prevent orphaned files
      if (media.cloudinaryId) {
        try {
          await CloudinaryService.deleteFile(media.cloudinaryId);
          logger.info('Cloudinary file deleted', { cloudinaryId: media.cloudinaryId });
        } catch (cloudinaryError) {
          // Log error with details for manual cleanup
          logger.error('Failed to delete from Cloudinary (orphan created)', {
            cloudinaryId: media.cloudinaryId,
            mediaId: media._id.toString(),
            userId,
            error: cloudinaryError instanceof Error ? cloudinaryError.message : 'Unknown error',
            requiresManualCleanup: true,
          });
        }
      }

      // Decrement storage usage
      await storageService.decrementUsage(userId, media.size);

      // Emit delete event
      mediaEvents.emit(MediaEventType.DELETED, {
        mediaId: media._id.toString(),
        userId,
        cloudinaryId: media.cloudinaryId,
        size: media.size,
      });

      logger.info('Media deleted successfully', { mediaId: media._id, userId });
    } catch (error) {
      logger.error('Media deletion failed:', error);
      throw error;
    }
  }

  // Bulk delete media with Cloudinary cleanup
  async bulkDeleteMedia(userId: string, mediaIds: string[]): Promise<{ deleted: number; errors: string[] }> {
    const errors: string[] = [];
    let deleted = 0;
    let totalSizeDeleted = 0;

    try {
      const mediaItems = await Media.find({
        _id: { $in: mediaIds.map(id => new Types.ObjectId(id)) },
        userId: new Types.ObjectId(userId)
      });

      for (const media of mediaItems) {
        try {
          // Validate media object has required fields
          if (!media._id || !media.size) {
            logger.warn('Invalid media object in bulk delete', { mediaId: media._id });
            errors.push(`Invalid media record: ${media.originalName || 'Unknown'}`);
            continue;
          }

          // Delete from Cloudinary first
          if (media.cloudinaryId) {
            try {
              await CloudinaryService.deleteFile(media.cloudinaryId);
            } catch (cloudinaryError) {
              logger.error('Cloudinary delete failed in bulk operation', {
                cloudinaryId: media.cloudinaryId,
                error: cloudinaryError instanceof Error ? cloudinaryError.message : 'Unknown error',
              });
              // Continue with DB deletion even if Cloudinary fails
            }
          }

          // Then delete from DB
          await Media.deleteOne({ _id: media._id });
          totalSizeDeleted += media.size;
          deleted++;

          // Emit delete event for each media
          mediaEvents.emit(MediaEventType.DELETED, {
            mediaId: media._id.toString(),
            userId,
            cloudinaryId: media.cloudinaryId,
            size: media.size,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const fileName = media.originalName || media.filename || 'Unknown file';
          errors.push(`Failed to delete ${fileName}: ${errorMessage}`);
          logger.error('Individual media deletion failed in bulk operation', {
            mediaId: media._id.toString(),
            fileName,
            error: errorMessage,
          });
        }
      }

      // Decrement storage usage for all deleted files
      if (totalSizeDeleted > 0) {
        await storageService.decrementUsage(userId, totalSizeDeleted);
      }

      logger.info('Bulk media delete completed', { deleted, errors: errors.length, userId });
      return { deleted, errors };
    } catch (error) {
      logger.error('Bulk media deletion failed:', error);
      throw error;
    }
  }

  async bulkMoveMedia(userId: string, mediaIds: string[], targetFolderId?: string): Promise<void> {
    try {
      const updateData: { folderId: Types.ObjectId | null } = {
        folderId: targetFolderId ? new Types.ObjectId(targetFolderId) : null
      };

      const result = await Media.updateMany(
        {
          _id: { $in: mediaIds.map(id => new Types.ObjectId(id)) },
          userId: new Types.ObjectId(userId)
        },
        { $set: updateData }
      );

      logger.info('Media bulk move successful', { count: result.modifiedCount, userId });
    } catch (error) {
      logger.error('Media bulk move failed:', error);
      throw error;
    }
  }

  // Delete all user data (Cascade Delete)
  async deleteUserData(userId: string): Promise<number> {
    const mediaItems = await Media.find({ userId });
    const mediaIds = mediaItems.map(m => m._id.toString());
    const result = await this.bulkDeleteMedia(userId, mediaIds);
    return result.deleted;
  }
}

export const mediaService = new MediaService();
export default mediaService;
