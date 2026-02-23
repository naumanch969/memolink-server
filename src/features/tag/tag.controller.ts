import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.utils';
import { Helpers } from '../../shared/helpers';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { CreateTagRequest, UpdateTagRequest } from './tag.interfaces';
import { tagService } from './tag.service';

export class TagController {
  static async createTag(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const tagData: CreateTagRequest = req.body;
      const tag = await tagService.createTag(userId, tagData);

      ResponseHelper.created(res, tag, 'Tag created successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to create tag', 500, error);
    }
  }

  static async getTagById(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { id } = req.params;
      const tag = await tagService.getTagById(id, userId);

      ResponseHelper.success(res, tag, 'Tag retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve tag', 500, error);
    }
  }

  static async getUserTags(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { page, limit } = req.query;
      const { page: pageNum, limit: limitNum } = Helpers.getPaginationParams({ page, limit });

      const result = await tagService.getUserTags(userId, { page: pageNum, limit: limitNum });

      ResponseHelper.paginated(res, result.tags, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      }, 'Tags retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve tags', 500, error);
    }
  }

  static async updateTag(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { id } = req.params;
      const updateData: UpdateTagRequest = req.body;
      const tag = await tagService.updateTag(id, userId, updateData);

      ResponseHelper.success(res, tag, 'Tag updated successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to update tag', 500, error);
    }
  }

  static async deleteTag(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { id } = req.params;
      await tagService.deleteTag(id, userId);

      ResponseHelper.success(res, null, 'Tag deleted successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to delete tag', 500, error);
    }
  }

  static async searchTags(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        ResponseHelper.badRequest(res, 'Query parameter "q" is required');
        return;
      }

      const tags = await tagService.searchTags(userId, q);
      ResponseHelper.success(res, tags, 'Tags searched successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to search tags', 500, error);
    }
  }

  // Get usage statistics for tags
  static async getTagStats(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const result = await tagService.getTagStats(userId);
      ResponseHelper.success(res, result, 'Tag statistics retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to get tag statistics', 500, error);
    }
  }
}

export default TagController;
