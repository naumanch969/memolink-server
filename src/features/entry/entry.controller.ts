import { Request, Response, NextFunction } from 'express';
import { entryService } from './entry.service';
import { ResponseHelper } from '../../core/utils/response';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { CreateEntryRequest, UpdateEntryRequest, EntrySearchRequest } from './entry.interfaces';
import { Helpers } from '../../shared/helpers';

export class EntryController {
  // Create new entry
  static createEntry = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!._id.toString();
      const entryData: CreateEntryRequest = req.body;
      const entry = await entryService.createEntry(userId, entryData);

      ResponseHelper.created(res, entry, 'Entry created successfully');
    }
    catch (err) {
      console.log('Error in createEntry:', err);
    }
  });

  // Get entry by ID
  static getEntryById = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    const entry = await entryService.getEntryById(id, userId);

    ResponseHelper.success(res, entry, 'Entry retrieved successfully');
  });

  // Get user entries
  static getUserEntries = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { page, limit, type, isPrivate } = req.query;
    const { page: pageNum, limit: limitNum } = Helpers.getPaginationParams({ page, limit });

    const options = {
      page: pageNum,
      limit: limitNum,
      order: 'asc',
      filter: {
        ...(type && { type }),
        ...(isPrivate !== undefined && { isPrivate: isPrivate === 'true' }),
      },
    };

    const result = await entryService.getUserEntries(userId, options);

    ResponseHelper.paginated(res, result.entries, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    }, 'Entries retrieved successfully');
  });

  // Search entries
  static searchEntries = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const searchParams: EntrySearchRequest = req.query;

    const result = await entryService.searchEntries(userId, searchParams);

    ResponseHelper.paginated(res, result.entries, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    }, 'Search completed successfully');
  });

  // Get feed
  static getFeed = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const feedParams = req.query;

    // Convert boolean strings to booleans
    const params = {
      ...feedParams,
      isPrivate: feedParams.isPrivate === 'true' ? true : feedParams.isPrivate === 'false' ? false : undefined,
      isImportant: feedParams.isImportant === 'true' ? true : feedParams.isImportant === 'false' ? false : undefined,
    };

    const result = await entryService.getFeed(userId, params);

    ResponseHelper.success(res, result, 'Feed retrieved successfully');
  });

  // Update entry
  static updateEntry = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    const updateData: UpdateEntryRequest = req.body;
    const entry = await entryService.updateEntry(id, userId, updateData);

    ResponseHelper.success(res, entry, 'Entry updated successfully');
  });

  // Delete entry
  static deleteEntry = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    await entryService.deleteEntry(id, userId);

    ResponseHelper.success(res, null, 'Entry deleted successfully');
  });

  // Get entry statistics
  static getEntryStats = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const stats = await entryService.getEntryStats(userId);

    ResponseHelper.success(res, stats, 'Entry statistics retrieved successfully');
  });
}

export default EntryController;
