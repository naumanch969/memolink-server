import { Media } from './media.model';
import { logger } from '../../config/logger';
import { createNotFoundError } from '../../core/middleware/errorHandler';
import { CreateMediaRequest, IMediaService, UpdateMediaRequest } from './media.interfaces';
import { Helpers } from '../../shared/helpers';
import { Types } from 'mongoose';
import { IMedia } from '../../shared/types';

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

  async getUserMedia(userId: string, options: any = {}): Promise<{
    media: IMedia[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const { page, limit, skip } = Helpers.getPaginationParams(options);
      const sort = Helpers.getSortParams(options, 'createdAt');

      const [media, total] = await Promise.all([
        Media.find({ userId }).sort(sort as any).skip(skip).limit(limit),
        Media.countDocuments({ userId }),
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
      logger.info('Media deleted successfully', { mediaId: media._id, userId });
    } catch (error) {
      logger.error('Media deletion failed:', error);
      throw error;
    }
  }
}

export const mediaService = new MediaService();

export default MediaService;
