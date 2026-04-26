import axios from 'axios';
import { Types } from 'mongoose';
import cloudinaryService from './cloudinary/cloudinary.service';
import { logger } from '../../config/logger';
import { ApiError } from '../../core/errors/api.error';
import { Helpers } from '../../shared/helpers';
import { mediaEvents, MediaEventType } from './media.events';
import { IMediaService } from "./media.interfaces";
import { Media } from './media.model';
import { CreateMediaRequest, IMedia, UpdateMediaRequest } from './media.types';
import { storageService } from './storage/storage.service';
import { config } from '../../config/env';
import { getMediaTypeFromMime } from '../../shared/constants';
import { MediaStatus } from './media.enums';
import { buildResolutionString } from './media.utils';

export class MediaService implements IMediaService {
 
  // Downloads media from WhatsApp Cloud API
  async downloadWhatsAppMedia(whatsappMediaId: string): Promise<Buffer> {
    const apiToken = config.WHATSAPP_API_TOKEN;
    if (!apiToken) {
      throw new Error('WHATSAPP_API_TOKEN is not configured');
    }

    logger.info('Fetching WhatsApp media URL', { whatsappMediaId });
    const mediaResponse = await axios.get(`https://graph.facebook.com/v21.0/${whatsappMediaId}`, {
      headers: { Authorization: `Bearer ${apiToken}` }
    });

    const url = mediaResponse.data.url;
    if (!url) {
      logger.error('Failed to get WhatsApp media URL', mediaResponse.data);
      throw new Error('Failed to get WhatsApp media URL');
    }

    logger.info('Downloading media from WhatsApp URL', { whatsappMediaId });
    const downloadResponse = await axios.get(url, {
      headers: { Authorization: `Bearer ${apiToken}` },
      responseType: 'arraybuffer'
    });

    return Buffer.from(downloadResponse.data);
  }

  async createMedia(userId: string, mediaData: CreateMediaRequest): Promise<IMedia> {
    try {
      const media = new Media({
        userId: new Types.ObjectId(userId),
        storageType: 'authenticated', // Default to new pattern for all new creations
        ...mediaData
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
        throw ApiError.notFound('Media');
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
        throw ApiError.notFound('Media');
      }
      return media;
    } catch (error) {
      logger.error('Get media by ID failed:', error);
      throw error;
    }
  }

  async getMediaBuffer(mediaId: string, userId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    try {
      const media = await this.getMediaById(mediaId, userId);
      const url = media.url;

      if (!url) {
        throw new Error('Media URL not found');
      }

      const response = await axios.get(url, { responseType: 'arraybuffer' });
      return {
        buffer: Buffer.from(response.data),
        mimeType: media.mimeType || String(response.headers['content-type'] || 'application/octet-stream')
      };
    } catch (error) {
      logger.error('Get media buffer failed:', error);
      throw error;
    }
  }

  async getUserMedia(userId: string, options: { page?: number; limit?: number; sort?: string; type?: string; folderId?: string | null; search?: string; } = {}): Promise<{ media: IMedia[]; total: number; page: number; limit: number; totalPages: number; }> {
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
        throw ApiError.notFound('Media');
      }

      // Delete from Cloudinary to prevent orphaned files
      if (media.cloudinaryId) {
        try {
          await cloudinaryService.deleteFile(media.cloudinaryId);
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
              await cloudinaryService.deleteFile(media.cloudinaryId);
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

  async getSignedUrl(mediaId: string, userId: string): Promise<string> {
    const media = await this.getMediaById(mediaId, userId);
    return cloudinaryService.getSignedUrl(media.cloudinaryId);
  }

  // Uploads a buffer to Cloudinary and creates a Media record
  // This is used for programmatic uploads like WhatsApp
  async uploadMediaFromBuffer(
    userId: string,
    buffer: Buffer,
    mimeType: string,
    originalName: string,
    options: { folderId?: string; tags?: string[] } = {}
  ): Promise<IMedia> {
    // 1. Reserve storage space
    const reservation = await storageService.reserveSpace(userId, buffer.length);

    try {
      // 2. Determine folder path
      const folder = cloudinaryService.getStoragePath(userId, 'timeline');

      // 3. Upload to Cloudinary
      const cloudinaryResult = await cloudinaryService.uploadLargeStream(
        [buffer],
        mimeType,
        originalName,
        folder
      );

      // 4. Determine media type
      const mediaType = getMediaTypeFromMime(mimeType);

      // 5. Create the Media record
      const mediaData: CreateMediaRequest = {
        filename: cloudinaryResult.public_id,
        originalName,
        mimeType,
        size: buffer.length,
        url: cloudinaryResult.secure_url,
        cloudinaryId: cloudinaryResult.public_id,
        type: mediaType as CreateMediaRequest['type'],
        folderId: options.folderId,
        tags: options.tags,
        status: MediaStatus.PROCESSING,
        metadata: {
          width: cloudinaryResult.width,
          height: cloudinaryResult.height,
          duration: cloudinaryResult.duration,
          resolution: buildResolutionString(cloudinaryResult.width, cloudinaryResult.height),
        }
      };

      const media = await this.createMedia(userId, mediaData);

      // 6. Finalize storage usage
      await reservation.commit();

      return media;
    } catch (error) {
      await reservation.rollback();
      logger.error('Failed to upload media from buffer:', error);
      throw error;
    }
  }
}

export const mediaService = new MediaService();
export default mediaService;
