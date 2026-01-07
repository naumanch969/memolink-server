import { Request, Response, NextFunction } from 'express';
import { tagService } from './tag.service';
import { ResponseHelper } from '../../core/utils/response';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { AuthenticatedRequest } from '../../shared/types';
import { CreateTagRequest, UpdateTagRequest } from './tag.interfaces';
import { Helpers } from '../../shared/helpers';

export class TagController {
  static createTag = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const tagData: CreateTagRequest = req.body;
    const tag = await tagService.createTag(userId, tagData);

    ResponseHelper.created(res, tag, 'Tag created successfully');
  });

  static getTagById = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    const tag = await tagService.getTagById(id, userId);

    ResponseHelper.success(res, tag, 'Tag retrieved successfully');
  });

  static getUserTags = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
  });

  static updateTag = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    const updateData: UpdateTagRequest = req.body;
    const tag = await tagService.updateTag(id, userId, updateData);

    ResponseHelper.success(res, tag, 'Tag updated successfully');
  });

  static deleteTag = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    await tagService.deleteTag(id, userId);

    ResponseHelper.success(res, null, 'Tag deleted successfully');
  });

  static searchTags = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      ResponseHelper.badRequest(res, 'Query parameter "q" is required');
      return;
    }

    const tags = await tagService.searchTags(userId, q);
    ResponseHelper.success(res, tags, 'Tags searched successfully');
  });
}

export default TagController;
