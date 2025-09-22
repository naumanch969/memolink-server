import { Tag } from './tag.model';
import { logger } from '../../config/logger';
import { createNotFoundError, createConflictError } from '../../core/middleware/errorHandler';
import { CreateTagRequest, UpdateTagRequest, ITagService } from './tag.interfaces';
import { Helpers } from '../../shared/helpers';
import { Types } from 'mongoose';
import { ITag } from '../../shared/types';

export class TagService implements ITagService {
  async createTag(userId: string, tagData: CreateTagRequest): Promise<ITag> {
    try {
      const existingTag = await Tag.findOne({ userId, name: tagData.name });
      if (existingTag) {
        throw createConflictError('Tag with this name already exists');
      }

      const tag = new Tag({
        userId: new Types.ObjectId(userId),
        ...tagData,
      });

      await tag.save();
      logger.info('Tag created successfully', { tagId: tag._id, userId });
      return tag;
    } catch (error) {
      logger.error('Tag creation failed:', error);
      throw error;
    }
  }

  async getTagById(tagId: string, userId: string): Promise<ITag> {
    try {
      const tag = await Tag.findOne({ _id: tagId, userId });
      if (!tag) {
        throw createNotFoundError('Tag');
      }
      return tag;
    } catch (error) {
      logger.error('Get tag by ID failed:', error);
      throw error;
    }
  }

  async getUserTags(userId: string, options: any = {}): Promise<{
    tags: ITag[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const { page, limit, skip } = Helpers.getPaginationParams(options);
      const sort = Helpers.getSortParams(options, 'usageCount');

      const [tags, total] = await Promise.all([
        Tag.find({ userId }).sort(sort as any).skip(skip).limit(limit),
        Tag.countDocuments({ userId }),
      ]);

      const totalPages = Math.ceil(total / limit);
      return { tags, total, page, limit, totalPages };
    } catch (error) {
      logger.error('Get user tags failed:', error);
      throw error;
    }
  }

  async updateTag(tagId: string, userId: string, updateData: UpdateTagRequest): Promise<ITag> {
    try {
      const tag = await Tag.findOneAndUpdate(
        { _id: tagId, userId },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!tag) {
        throw createNotFoundError('Tag');
      }

      logger.info('Tag updated successfully', { tagId: tag._id, userId });
      return tag;
    } catch (error) {
      logger.error('Tag update failed:', error);
      throw error;
    }
  }

  async deleteTag(tagId: string, userId: string): Promise<void> {
    try {
      const tag = await Tag.findOneAndDelete({ _id: tagId, userId });
      if (!tag) {
        throw createNotFoundError('Tag');
      }
      logger.info('Tag deleted successfully', { tagId: tag._id, userId });
    } catch (error) {
      logger.error('Tag deletion failed:', error);
      throw error;
    }
  }
}

export const tagService = new TagService();

export default TagService;
