import { Response } from 'express';
import { logger } from '../../config/logger';
import { ResponseHelper } from '../../core/utils/response.utils';
import DateUtil from '../../shared/utils/date.utils';
import { AuthenticatedRequest } from '../auth/auth.types';
import { enrichmentService } from '../enrichment/enrichment.service';
import { entryService } from './entry.service';

export class EntryController {

  // Get user entries with pagination and filtering
  static async getUserEntries(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await entryService.getEntries(req.user!._id.toString(), req.query as any);

      ResponseHelper.success(res, result, 'Entries retrieved successfully');
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
      const entry = await entryService.deleteEntry(req.params.id, req.user!._id.toString());
      ResponseHelper.success(res, entry, 'Entry deleted successfully');
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

  // Toggle pin status
  static async togglePin(req: AuthenticatedRequest, res: Response) {
    try {
      const entry = await entryService.togglePin(req.params.id, req.user!._id.toString());
      ResponseHelper.success(res, entry, 'Entry pin status updated');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to update pin status', 500, error);
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
      const result = await entryService.getEntries(req.user!._id.toString(), { ...req.query, q: req.query.q } as any);

      ResponseHelper.success(res, result, 'Search results retrieved');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to search entries', 500, error);
    }
  }

  // Get feed
  static async getFeed(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await entryService.getEntries(req.user!._id.toString(), req.query as any);
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

  // Heal entry manually
  static async healEntry(req: AuthenticatedRequest, res: Response) {
    try {
      const entry = await entryService.getEntryById(req.params.id, req.user!._id.toString());
      if (!entry) {
        ResponseHelper.notFound(res, 'Entry not found');
        return;
      }

      let sessionId = entry.sessionId;
      if (!sessionId) {
        sessionId = DateUtil.getSessionId((entry as any).createdAt || entry.date);
      }

      // Trigger active enrichment asynchronously
      enrichmentService.processActiveEnrichment(req.user!._id.toString(), req.params.id, sessionId)
        .catch(e => logger.error(`Manual healing failed for entry ${req.params.id}:`, e));

      ResponseHelper.success(res, null, 'Enrichment retry triggered');
    } catch (error) {
      logger.error('Manual heal entry failed:', error);
      ResponseHelper.error(res, 'Failed to retry enrichment', 500, error);
    }
  }
}
