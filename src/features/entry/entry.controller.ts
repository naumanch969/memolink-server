import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.util';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { EntrySearchRequest } from './entry.interfaces';
import { entryService } from './entry.service';

export class EntryController {
  // Create new entry
  static async createEntry(req: AuthenticatedRequest, res: Response) {
    try {
      const entry = await entryService.createEntry(req.user!._id.toString(), req.body);
      ResponseHelper.created(res, entry, 'Entry created successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to create entry', 500, error);
    }
  }

  // Get user entries with pagination and filtering
  static async getUserEntries(req: AuthenticatedRequest, res: Response) {
    try {
      // req.query is pre-parsed and coerced by Zod in the route
      const result = await entryService.getUserEntries(req.user!._id.toString(), req.query as unknown as EntrySearchRequest);

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
      const entry = await entryService.getEntryById(req.params.id, req.user!._id.toString());
      ResponseHelper.success(res, entry, 'Entry retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve entry', 500, error);
    }
  }

  // Update entry
  static async updateEntry(req: AuthenticatedRequest, res: Response) {
    try {
      const entry = await entryService.updateEntry(req.params.id, req.user!._id.toString(), req.body);
      ResponseHelper.success(res, entry, 'Entry updated successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to update entry', 500, error);
    }
  }

  // Delete entry
  static async deleteEntry(req: AuthenticatedRequest, res: Response) {
    try {
      await entryService.deleteEntry(req.params.id, req.user!._id.toString());
      ResponseHelper.success(res, null, 'Entry deleted successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to delete entry', 500, error);
    }
  }

  // Toggle favorite status
  static async toggleFavorite(req: AuthenticatedRequest, res: Response) {
    try {
      const entry = await entryService.toggleFavorite(req.params.id, req.user!._id.toString());
      ResponseHelper.success(res, entry, 'Entry favorite status updated');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to update favorite status', 500, error);
    }
  }

  // Get entries mostly for calendar view (minimal data)
  static async getCalendarEntries(req: AuthenticatedRequest, res: Response) {
    try {
      const { start, end } = req.query;
      if (!start || !end) {
        ResponseHelper.badRequest(res, 'Start and end dates are required');
        return;
      }

      const entries = await entryService.getCalendarEntries(req.user!._id.toString(), start as string, end as string);
      ResponseHelper.success(res, entries, 'Calendar entries retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve calendar entries', 500, error);
    }
  }

  // Search entries
  static async searchEntries(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await entryService.searchEntries(req.user!._id.toString(), req.query as unknown as EntrySearchRequest);

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
      const result = await entryService.getFeed(req.user!._id.toString(), req.query);
      ResponseHelper.success(res, result, 'Feed retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve feed', 500, error);
    }
  }

  // Get stats
  static async getEntryStats(req: AuthenticatedRequest, res: Response) {
    try {
      const stats = await entryService.getEntryStats(req.user!._id.toString());
      ResponseHelper.success(res, stats, 'Entry stats retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve entry stats', 500, error);
    }
  }
}
