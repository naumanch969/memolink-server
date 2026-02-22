import { Response } from 'express';
import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { ResponseHelper } from '../../core/utils/response.util';
import { ENTRY_TYPES } from '../../shared/constants';
import { MongoUtil } from '../../shared/utils/mongo.util';
import { StringUtil } from '../../shared/utils/string.util';
import agentService from '../agent/agent.service';
import { AgentTaskType } from '../agent/agent.types';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import KnowledgeEntity from '../entity/entity.model';
import { entityService } from '../entity/entity.service';
import { EdgeType, NodeType } from '../graph/edge.model';
import { graphService } from '../graph/graph.service';
import { moodService } from '../mood/mood.service';
import { tagService } from '../tag/tag.service';
import { entryService } from './entry.service';

export class EntryController {
  // Create new entry
  static async createEntry(req: AuthenticatedRequest, res: Response) {
    try {
      const { content, tags, mood, metadata, type } = req.body;
      const userId = req.user!._id.toString();

      // 1. EXTRACT MENTIONS
      const mentionNames = StringUtil.extractMentions(content || '');
      const mentionIds: string[] = [];
      for (const name of mentionNames) {
        const entity = await entityService.findOrCreateEntity(userId, name, NodeType.PERSON);
        mentionIds.push(entity._id.toString());
      }

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

      // 3. DETERMINE AI NEEDS
      const needsAI = req.body.status === 'processing' || (content && (content.length > 20 || type === ENTRY_TYPES.MEDIA));

      // 4. CREATE ENTRY VIA SERVICE
      const entry = await entryService.createEntry(userId, {
        ...req.body,
        mentions: mentionIds,
        tags: tagIds,
        status: needsAI ? 'processing' : 'ready'
      });

      // 5. POST-CREATE SIDE EFFECTS (Fire and forget or background tasks)
      // Update Tag Usage
      if (explicitTags.length > 0) {
        tagService.incrementUsage(userId, explicitTags).catch(e => logger.error('Tag usage increment failed', e));
      }

      // Update Entities & Graph
      if (mentionIds.length > 0) {
        KnowledgeEntity.updateMany(
          { _id: { $in: mentionIds.map(id => new Types.ObjectId(id)) } },
          { $inc: { interactionCount: 1 }, $set: { lastInteractionAt: new Date() } }
        ).catch(e => logger.error('Entity interaction update failed', e));

        for (const mId of mentionIds) {
          graphService.createEdge({
            fromId: mId,
            fromType: NodeType.PERSON,
            toId: entry._id.toString(),
            toType: NodeType.CONTEXT,
            relation: EdgeType.MENTIONED_IN,
            weight: 1.0,
            metadata: { entryDate: entry.date }
          }).catch(err => logger.warn(`Failed to create MENTIONED_IN edge`, err));
        }
      }

      // TRIGGER AGENT TASK
      if (needsAI) {
        agentService.createTask(userId, AgentTaskType.INTENT_PROCESSING, {
          entryId: entry._id.toString(),
          text: entry.content,
          options: { timezone: metadata?.timezone }
        }).catch(err => logger.error('Failed to trigger intent processing', err));
      }

      // MOOD RECALCULATION
      if (mood) {
        moodService.recalculateDailyMoodFromEntries(userId, entry.date || new Date())
          .catch(err => logger.error('Failed to auto-update daily mood', err));
      }

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
      const result = await entryService.getEntries(req.user!._id.toString(), { ...req.query, q: req.query.q } as any);

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
}
