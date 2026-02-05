import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { createConflictError, createNotFoundError } from '../../core/middleware/errorHandler';
import { Helpers } from '../../shared/helpers';
import { CreateTagRequest, ITag, ITagService, UpdateTagRequest } from './tag.interfaces';
import { Tag } from './tag.model';

export class TagService implements ITagService {
  async createTag(userId: string, tagData: CreateTagRequest): Promise<ITag> {
    try {
      if (tagData.name) {
        tagData.name = tagData.name.toUpperCase();
      }
      const existingTag = await Tag.findOne({ userId, name: tagData.name });
      if (existingTag) {
        throw createConflictError('Tag with this name already exists');
      }

      const tag = new Tag({
        userId: new Types.ObjectId(userId),
        ...tagData,
        color: tagData.color || Helpers.generateRandomHexColor()
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

  async getUserTags(userId: string, options: any = {}): Promise<{ tags: ITag[]; total: number; page: number; limit: number; totalPages: number; }> {
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
      if (updateData.name) {
        updateData.name = updateData.name.toUpperCase();
      }
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

  async searchTags(userId: string, query: string): Promise<ITag[]> {
    try {
      const tags = await Tag.find({
        userId,
        name: { $regex: query, $options: 'i' }
      })
        .limit(10)
        .sort({ usageCount: -1 });

      return tags;
    } catch (error) {
      logger.error('Search tags failed:', error);
      throw error;
    }
  }

  async findOrCreateTag(userId: string, name: string): Promise<ITag> {
    try {
      const uppercasedName = name.toUpperCase();
      // Try to find existing tag
      let tag = await Tag.findOne({
        userId,
        name: uppercasedName
      });

      if (!tag) {
        // Create new tag
        tag = new Tag({
          userId: new Types.ObjectId(userId),
          name: uppercasedName,
          color: Helpers.generateRandomHexColor()
        });
        await tag.save();
        logger.info('Tag auto-created', { tagId: tag._id, userId, name: uppercasedName });
      }

      return tag;
    } catch (error) {
      logger.error('Find or create tag failed:', error);
      throw error;
    }
  }

  async incrementUsage(userId: string, tagIds: string[]): Promise<void> {
    try {
      if (!tagIds || tagIds.length === 0) return;

      const objectIds = tagIds.map(id => new Types.ObjectId(id));
      await Tag.updateMany(
        { _id: { $in: objectIds }, userId },
        { $inc: { usageCount: 1 } }
      );
    } catch (error) {
      logger.error('Increment usage failed:', error);
      // We don't throw here to prevent unnecessary failures in main flow
    }
  }

  async decrementUsage(userId: string, tagIds: string[]): Promise<void> {
    try {
      if (!tagIds || tagIds.length === 0) return;

      const objectIds = tagIds.map(id => new Types.ObjectId(id));
      // Ensure usageCount doesn't go below 0
      await Tag.updateMany(
        { _id: { $in: objectIds }, userId, usageCount: { $gt: 0 } },
        { $inc: { usageCount: -1 } }
      );
    } catch (error) {
      logger.error('Decrement usage failed:', error);
    }
  }

  async getTagStats(userId: string, data?: any) {
    // TODO: Implement business logic
    return {};
  }

  // Delete all user data (Cascade Delete)
  async deleteUserData(userId: string): Promise<number> {
    const result = await Tag.deleteMany({ userId });
    logger.info(`Deleted ${result.deletedCount} tags for user ${userId}`);
    return result.deletedCount || 0;
  }
}

export const tagService = new TagService();
export default tagService;
