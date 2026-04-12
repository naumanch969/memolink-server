import { Response } from 'express';
import { logger } from '../../config/logger';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import { ResponseHelper } from '../../core/utils/response.utils';
import { ENTRY_TYPES } from '../../shared/constants';
import DateUtil from '../../shared/utils/date.utils';
import { MongoUtil } from '../../shared/utils/mongo.utils';
import { AgentTaskType } from '../agent/agent.types';
import agentService from '../agent/services/agent.service';
import { AuthenticatedRequest } from '../auth/auth.types';
import { HEALING_STALENESS_THRESHOLD_MS } from '../enrichment/enrichment.constants';
import { enrichmentService } from '../enrichment/enrichment.service';
import { tagService } from '../tag/tag.service';
import { entryService } from './entry.service';

import { entryClassifier } from '../enrichment/enrichment.classifier';

export class EntryController {
  // Create new entry
  static async createEntry(req: AuthenticatedRequest, res: Response) {
    try {
      const { content, tags, metadata, type } = req.body;
      const userId = req.user!._id.toString();

      // 2. PROCESS TAGS (Resolve strings to IDs)
      const explicitTags = tags || [];
      const tagIds: string[] = [];
      for (const tagIdentifier of explicitTags) {
        if (MongoUtil.isValidObjectId(tagIdentifier)) {
          tagIds.push(tagIdentifier);
        } else {
          const tag = await tagService.findOrCreateTag(userId, tagIdentifier);
          tagIds.push(tag._id.toString());
        }
      }

      // Classify signal tier
      const isMediaOrVoice = type === 'media' || type === 'voice' || metadata?.isVoice;
      const { tier } = entryClassifier.classify(content || '', req.body.isImportant ?? false, isMediaOrVoice);

      // 3. DETERMINE AI NEEDS
      const needsAI = req.body.status === 'processing' || (content && (content.length > 20 || type === ENTRY_TYPES.MEDIA));

      // 4. CREATE ENTRY VIA SERVICE
      const entry = await entryService.createEntry(userId, {
        ...req.body,
        tags: tagIds,
        status: needsAI ? 'processing' : 'ready',
        signalTier: tier
      });

      // 5. POST-CREATE SIDE EFFECTS (Fire and forget | background tasks)
      // Update Tag Usage
      if (explicitTags.length > 0) {
        tagService.incrementUsage(userId, explicitTags).catch(e => logger.error('Tag usage increment failed', e));
      }

      // TRIGGER ACTIVE ENRICHMENT
      if (needsAI) {
        const dateForSession = (entry as any).createdAt || entry.date || new Date();
        const sessionId = DateUtil.getSessionId(dateForSession);

        enrichmentService.enqueueActiveEnrichment(
          userId,
          entry._id.toString(),
          sessionId,
          tier
        ).catch(async (err) => {
          logger.error('Failed to enqueue enrichment', err);
          const failedEntry = await entryService.updateEntry(entry._id.toString(), userId, {
            status: 'failed',
            metadata: { ...entry.metadata, error: 'Failed to enqueue AI task' }
          });
          socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, failedEntry);
        });
      }

      // 6. EMIT CREATION EVENT
      socketService.emitToUser(userId, SocketEvents.ENTRY_CREATED, entry);

      ResponseHelper.created(res, entry, 'Entry created successfully');
    } catch (error) {
      logger.error('Entry creation controller failed:', error);
      ResponseHelper.error(res, 'Failed to create entry', 500, error);
    }
  }

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

      const createdAtTime = (entry as any).createdAt ? new Date((entry as any).createdAt).getTime() : new Date(entry.date).getTime();

      // TODO: this check is removed for MVP
      // const isOldEnough = Date.now() - createdAtTime >= HEALING_STALENESS_THRESHOLD_MS;

      // if (!isOldEnough) {
      //   ResponseHelper.badRequest(res, 'Entry must be at least one hour old to retry enrichment.');
      //   return;
      // }

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
