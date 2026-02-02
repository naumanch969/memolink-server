import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response';
import { Helpers } from '../../shared/helpers';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { CreateEntryRequest, EntrySearchRequest, UpdateEntryRequest } from './entry.interfaces';
import { entryService } from './entry.service';

export class EntryController {
  // Create new entry
  static async createEntry(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const entryData: CreateEntryRequest = req.body;
      const entry = await entryService.createEntry(userId, entryData);

      ResponseHelper.created(res, entry, 'Entry created successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to create entry', 500, error);
    }
  }

  // Get user entries with pagination and filtering
  static async getUserEntries(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { page, limit, search, tags, startDate, endDate, mood, isFavorite } = req.query;
      const { page: pageNum, limit: limitNum } = Helpers.getPaginationParams({ page, limit });

      const searchParams: EntrySearchRequest = {
        page: pageNum,
        limit: limitNum,
        tags: tags ? (tags as string).split(',') : undefined,
        dateFrom: startDate as string,
        dateTo: endDate as string,
        mood: mood as string,
        isFavorite: isFavorite === 'true' ? true : (isFavorite === 'false' ? false : undefined),
      };

      const result = await entryService.getUserEntries(userId, searchParams);

      ResponseHelper.paginated(res, result.entries, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      }, 'Entries retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve entries', 500, error);
    }
  }

  // Get single entry by ID
  static async getEntryById(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { id } = req.params;
      const entry = await entryService.getEntryById(id, userId);

      ResponseHelper.success(res, entry, 'Entry retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve entry', 500, error);
    }
  }

  // Update entry
  static async updateEntry(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { id } = req.params;
      const updateData: UpdateEntryRequest = req.body;
      const entry = await entryService.updateEntry(id, userId, updateData);

      ResponseHelper.success(res, entry, 'Entry updated successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to update entry', 500, error);
    }
  }

  // Delete entry
  static async deleteEntry(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { id } = req.params;
      await entryService.deleteEntry(id, userId);

      ResponseHelper.success(res, null, 'Entry deleted successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to delete entry', 500, error);
    }
  }

  // Toggle favorite status
  static async toggleFavorite(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { id } = req.params;
      const entry = await entryService.toggleFavorite(id, userId);

      ResponseHelper.success(res, entry, 'Entry favorite status updated');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to update favorite status', 500, error);
    }
  }

  // Get entries mostly for calendar view (minimal data)
  static async getCalendarEntries(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { start, end } = req.query;

      if (!start || !end) {
        ResponseHelper.badRequest(res, 'Start and end dates are required');
        return;
      }

      const entries = await entryService.getCalendarEntries(userId, start as string, end as string);
      ResponseHelper.success(res, entries, 'Calendar entries retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve calendar entries', 500, error);
    }
  }

  // Search entries
  static async searchEntries(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const searchParams: EntrySearchRequest = req.query as any;
      const result = await entryService.searchEntries(userId, searchParams);

      ResponseHelper.paginated(res, result.entries, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      }, 'Search results retrieved');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to search entries', 500, error);
    }
  }

  // Get feed
  static async getFeed(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const result = await entryService.getFeed(userId, req.query);

      ResponseHelper.success(res, result, 'Feed retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve feed', 500, error);
    }
  }

  // Get stats
  static async getEntryStats(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const stats = await entryService.getEntryStats(userId);
      ResponseHelper.success(res, stats, 'Entry stats retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve entry stats', 500, error);
    }
  }
}
