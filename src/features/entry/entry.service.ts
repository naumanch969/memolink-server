import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { ApiError } from '../../core/errors/api.error';
import { MongoUtil } from '../../shared/utils/mongo.util';
import { PaginationUtil } from '../../shared/utils/pagination.util';
import agentService from '../agent/agent.service';
import { AgentTaskType } from '../agent/agent.types';
import { runEntryTagging } from '../agent/workflows/tagging.workflow';
import KnowledgeEntity from '../entity/entity.model';
import { entityService } from '../entity/entity.service';
import { EdgeType, NodeType } from '../graph/edge.model';
import { graphService } from '../graph/graph.service';
import { moodService } from '../mood/mood.service';
import { tagService } from '../tag/tag.service';
import { entryFeedService } from './entry-feed.service';
import { entrySearchService } from './entry-search.service';
import { entryStatsService } from './entry-stats.service';
import {
  CreateEntryRequest,
  EntryFeedRequest,
  EntryFeedResponse,
  EntrySearchRequest,
  EntryStats,
  IEntry,
  IEntryService,
  UpdateEntryRequest
} from './entry.interfaces';
import { Entry } from './entry.model';
import { classifyMood } from './mood.config';

export class EntryService implements IEntryService {
  /**
   * Helper method to extract mentions from content
   */
  private extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    return mentions;
  }

  /**
   * Create new entry and trigger relevant agent workflows
   */
  async createEntry(userId: string, entryData: CreateEntryRequest): Promise<IEntry> {
    try {
      // 1. FAST DEDUPLICATION (Double-submit prevention)
      const last30Secs = new Date(Date.now() - 30000);
      const existing = await Entry.findOne({
        userId: new Types.ObjectId(userId),
        content: entryData.content?.trim(),
        createdAt: { $gt: last30Secs }
      }).select('_id');

      if (existing) {
        logger.info('Duplicate entry detected (30s window), returning existing', { userId, entryId: existing._id });
        return this.getEntryById(existing._id.toString(), userId);
      }

      // 2. Extract and resolve mentions/entities
      const mentionNames = this.extractMentions(entryData.content || '');
      const mentionIds: Types.ObjectId[] = [];
      for (const name of mentionNames) {
        const entity = await entityService.findOrCreateEntity(userId, name, NodeType.PERSON);
        mentionIds.push(entity._id as Types.ObjectId);
      }

      // 3. Process tags
      const explicitTags = entryData.tags || [];
      const tagIds: Types.ObjectId[] = [];
      for (const tagIdentifier of explicitTags) {
        if (MongoUtil.isValidObjectId(tagIdentifier)) {
          tagIds.push(new Types.ObjectId(tagIdentifier));
        } else {
          const tag = await tagService.findOrCreateTag(userId, tagIdentifier);
          tagIds.push(tag._id as Types.ObjectId);
        }
      }

      // 4. Create Entry
      const entry = new Entry({
        userId: new Types.ObjectId(userId),
        ...entryData,
        mentions: [...(entryData.mentions || []), ...mentionIds],
        tags: tagIds,
        moodMetadata: entryData.mood ? classifyMood(entryData.mood) : undefined
      });

      await entry.save();
      await entry.populate(['mentions', 'tags', 'media']);

      // 5. Update Metadata & Graph (Post-Save)
      if (explicitTags.length > 0) {
        await tagService.incrementUsage(userId, explicitTags);
      }

      if (mentionIds.length > 0) {
        await KnowledgeEntity.updateMany(
          { _id: { $in: mentionIds } },
          { $inc: { interactionCount: 1 }, $set: { lastInteractionAt: new Date() } }
        );

        for (const mId of mentionIds) {
          await graphService.createEdge({
            fromId: mId.toString(),
            fromType: NodeType.PERSON,
            toId: entry._id.toString(),
            toType: NodeType.CONTEXT,
            relation: EdgeType.MENTIONED_IN,
            weight: 1.0,
            metadata: { entryDate: entry.date }
          }).catch(err => logger.warn(`Failed to create MENTIONED_IN edge`, err));
        }
      }

      // 6. Trigger Agent Workflows
      if (entryData.content && entryData.content.length > 20) {
        agentService.createTask(userId, AgentTaskType.ENTRY_TAGGING, {
          entryId: entry._id.toString(),
          content: entryData.content
        }).catch(err => logger.error('Failed to trigger auto-tagging', err));

        agentService.createTask(userId, AgentTaskType.ENTITY_EXTRACTION, {
          entryId: entry._id.toString(),
          userId
        }).catch(err => logger.error('Failed to trigger entity extraction', err));

        agentService.createTask(userId, AgentTaskType.EMBED_ENTRY, {
          entryId: entry._id.toString()
        }).catch(err => logger.error('Failed to trigger entry embedding', err));
      }

      // 7. Fire-and-forget background mood recalculation
      moodService.recalculateDailyMoodFromEntries(userId, entry.date || new Date())
        .catch(err => logger.error('Failed to auto-update daily mood', err));

      return entry;
    } catch (error) {
      logger.error('Entry creation failed:', error);
      throw error;
    }
  }

  /**
   * Fetch a single entry by ID with populated relations
   */
  async getEntryById(entryId: string, userId: string): Promise<IEntry> {
    const entry = await Entry.findOne({ _id: entryId, userId }).populate(['mentions', 'tags', 'media']);
    if (!entry) throw ApiError.notFound('Entry');
    return entry;
  }

  /**
   * Basic filtered list of entries with pagination
   */
  async getUserEntries(userId: string, options: any = {}): Promise<{ entries: IEntry[]; total: number; page: number; limit: number; totalPages: number; }> {
    try {
      const { page, limit, skip } = PaginationUtil.getPaginationParams(options);
      const sort = PaginationUtil.getSortParams(options, 'createdAt');

      const filter: any = { userId: new Types.ObjectId(userId) };

      if (options.dateFrom || options.dateTo) {
        filter.date = {};
        if (options.dateFrom) filter.date.$gte = new Date(options.dateFrom);
        if (options.dateTo) filter.date.$lte = new Date(options.dateTo);
      }

      if (options.mood) filter.mood = new RegExp(options.mood, 'i');
      if (options.isFavorite !== undefined) filter.isFavorite = options.isFavorite;

      if (options.tags && options.tags.length > 0) {
        filter.tags = { $in: options.tags.map((id: string) => new Types.ObjectId(id)) };
      }

      const [entries, total] = await Promise.all([
        Entry.find(filter)
          .populate([{ path: 'mentions' }, { path: 'tags' }, { path: 'media' }])
          .sort(sort as any)
          .skip(skip)
          .limit(limit)
          .lean(),
        Entry.countDocuments(filter),
      ]);

      return {
        entries: entries as unknown as IEntry[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      logger.error(`Get entries failed for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Delegate search to EntrySearchService
   */
  async searchEntries(userId: string, searchParams: EntrySearchRequest) {
    return entrySearchService.search(userId, searchParams);
  }

  /**
   * Delegate feed to EntryFeedService
   */
  async getFeed(userId: string, feedParams: EntryFeedRequest): Promise<EntryFeedResponse> {
    return entryFeedService.getFeed(userId, feedParams);
  }

  /**
   * Delegate stats to EntryStatsService
   */
  async getEntryStats(userId: string): Promise<EntryStats> {
    return entryStatsService.getStats(userId);
  }

  /**
   * Update entry and re-trigger mood calculation if needed
   */
  async updateEntry(entryId: string, userId: string, updateData: UpdateEntryRequest): Promise<IEntry> {
    try {
      const existingEntry = await Entry.findOne({ _id: entryId, userId });
      if (!existingEntry) throw ApiError.notFound('Entry');

      const oldTags = (existingEntry.tags || []).map(t => t.toString());

      if (updateData.tags) {
        const resolvedTagIds: string[] = [];
        for (const tagIdentifier of updateData.tags) {
          if (MongoUtil.isValidObjectId(tagIdentifier)) {
            resolvedTagIds.push(tagIdentifier);
          } else {
            const tag = await tagService.findOrCreateTag(userId, tagIdentifier);
            resolvedTagIds.push(tag._id.toString());
          }
        }
        updateData.tags = resolvedTagIds;
      }

      const entry = await Entry.findOneAndUpdate(
        { _id: entryId, userId },
        {
          $set: {
            ...updateData,
            isEdited: true,
            moodMetadata: updateData.mood ? classifyMood(updateData.mood) : existingEntry.moodMetadata
          }
        },
        { new: true, runValidators: true }
      ).populate(['mentions', 'tags', 'media']);

      if (!entry) throw ApiError.notFound('Entry');

      if (updateData.tags) {
        const newTags = updateData.tags;
        const addedTags = newTags.filter((t: string) => !oldTags.includes(t));
        const removedTags = oldTags.filter((t: string) => !newTags.includes(t));

        if (addedTags.length > 0) await tagService.incrementUsage(userId, addedTags);
        if (removedTags.length > 0) await tagService.decrementUsage(userId, removedTags);
      }

      moodService.recalculateDailyMoodFromEntries(userId, entry.date || new Date())
        .catch(err => logger.error('Failed to auto-update daily mood', err));

      return entry;
    } catch (error) {
      logger.error('Entry update failed:', error);
      throw error;
    }
  }

  /**
   * Delete entry and update tag usage metrics
   */
  async deleteEntry(entryId: string, userId: string): Promise<void> {
    try {
      const entry = await Entry.findOneAndDelete({ _id: entryId, userId });
      if (!entry) throw ApiError.notFound('Entry');

      if (entry.tags && entry.tags.length > 0) {
        const tagIds = entry.tags.map(t => t.toString());
        await tagService.decrementUsage(userId, tagIds);
      }
    } catch (error) {
      logger.error('Entry deletion failed:', error);
      throw error;
    }
  }

  /**
   * Toggle favorite status of an entry
   */
  async toggleFavorite(entryId: string, userId: string): Promise<IEntry> {
    const entry = await Entry.findOne({ _id: entryId, userId });
    if (!entry) throw ApiError.notFound('Entry');
    entry.isFavorite = !entry.isFavorite;
    await entry.save();
    return entry;
  }

  /**
   * Minimal data fetch for calendar views
   */
  async getCalendarEntries(userId: string, startDate: string, endDate: string): Promise<any[]> {
    return Entry.find({
      userId,
      date: { $gte: new Date(startDate), $lte: new Date(endDate) }
    }).select('date mood type isImportant isFavorite title').sort({ date: 1 });
  }

  /**
   * Cascade delete all user entries
   */
  async deleteUserData(userId: string): Promise<number> {
    const result = await Entry.deleteMany({ userId });
    logger.info(`Deleted ${result.deletedCount} entries for user ${userId}`);
    return result.deletedCount || 0;
  }

  /**
   * Self-Healing: Process entries that missed AI processing
   */
  async selfHealEntries(limit: number = 10): Promise<number> {
    try {
      const untaggedEntries = await Entry.find({
        aiProcessed: { $ne: true },
        content: { $exists: true, $ne: '' },
        $expr: { $gt: [{ $strLenCP: "$content" }, 20] }
      }).sort({ createdAt: -1 }).limit(limit);

      if (untaggedEntries.length === 0) return 0;

      let successCount = 0;
      for (const entry of untaggedEntries) {
        try {
          await runEntryTagging(entry?.userId?.toString(), {
            entryId: entry._id.toString(),
            content: entry.content
          });
          successCount++;
        } catch (err) {
          logger.error(`Self-Healing failed for entry ${entry._id}`, err);
        }
      }

      return successCount;
    } catch (error) {
      logger.error('Self-healing entries failed', error);
      return 0;
    }
  }
}

export const entryService = new EntryService();
export default entryService;
