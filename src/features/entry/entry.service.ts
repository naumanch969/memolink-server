import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { LLMService } from '../../core/llm/llm.service';
import { createNotFoundError } from '../../core/middleware/errorHandler';
import { Helpers } from '../../shared/helpers';
import KnowledgeEntity from '../entity/entity.model';
import { entityService } from '../entity/entity.service';
import { EdgeType, NodeType } from '../graph/edge.model';
import { graphService } from '../graph/graph.service';
import { tagService } from '../tag/tag.service';
import { CreateEntryRequest, EntryFeedRequest, EntrySearchRequest, EntryStats, IEntry, IEntryService, UpdateEntryRequest } from './entry.interfaces';
import { Entry } from './entry.model';
import { classifyMood } from './mood.config';

export class EntryService implements IEntryService {
  // Helper method to extract mentions from content
  private extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    return mentions;
  }

  // Create new entry
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

      // Extract mentions from content
      const mentionNames = this.extractMentions(entryData.content || '');

      // Auto-create or find entities for mentions
      const mentionIds: Types.ObjectId[] = [];
      for (const name of mentionNames) {
        const entity = await entityService.findOrCreateEntity(userId, name, NodeType.PERSON);
        mentionIds.push(entity._id as Types.ObjectId);
      }

      // Use explicit tags provided by client
      // Process tags (IDs or Names)
      const explicitTags = entryData.tags || [];
      const tagIds: Types.ObjectId[] = [];

      for (const tagIdentifier of explicitTags) {
        if (Types.ObjectId.isValid(tagIdentifier)) {
          tagIds.push(new Types.ObjectId(tagIdentifier));
        } else {
          // It's a new tag name
          const tag = await tagService.findOrCreateTag(userId, tagIdentifier);
          tagIds.push(tag._id as Types.ObjectId);
        }
      }

      const entry = new Entry({
        userId: new Types.ObjectId(userId),
        ...entryData,
        mentions: [...(entryData.mentions || []), ...mentionIds],
        tags: tagIds,
        moodMetadata: entryData.mood ? classifyMood(entryData.mood) : undefined
      });

      await entry.save();
      await entry.populate(['mentions', 'tags', 'media']);

      // Increment tag usage
      if (explicitTags.length > 0) {
        await tagService.incrementUsage(userId, explicitTags);
      }

      // Tracking interaction metrics and creating Graph Edges
      if (mentionIds.length > 0) {
        await KnowledgeEntity.updateMany(
          { _id: { $in: mentionIds } },
          {
            $inc: { interactionCount: 1 },
            $set: { lastInteractionAt: new Date() }
          }
        );

        // Create Graph Edges (MENTIONED_IN)
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

      logger.info('Entry created successfully', {
        entryId: entry._id,
        userId,
        mentionsCount: mentionIds.length,
        tagsCount: tagIds.length,
      });

      // TRIGGER AGENT: Auto-Tagging & Entity Extraction
      if (entryData.content && entryData.content.length > 20) {
        Promise.all([
          import('../agent/agent.service'),
          import('../agent/agent.types')
        ]).then(([{ agentService }, { AgentTaskType }]) => {
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
        });
      }

      // Background Task: Update Daily Mood based on entries
      // Fire and forget - do not await
      this.updateDailyMood(userId, entry.date || new Date())
        .catch(err => logger.error('Failed to auto-update daily mood', err));

      return entry;
    } catch (error) {
      logger.error('Entry creation failed:', error);
      throw error;
    }
  }

  // Helper to map mood strings to scores (1-5)
  private getMoodScore(mood: string): number {
    const classified = classifyMood(mood);
    return classified ? classified.score : 0;
  }

  private async updateDailyMood(userId: string, date: Date): Promise<void> {
    try {
      const { moodService } = await import('../mood/mood.service');

      // 1. Get date range for the day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // 2. Fetch all entries for this day that have a mood
      const entries = await Entry.find({
        userId: new Types.ObjectId(userId),
        date: { $gte: startOfDay, $lte: endOfDay },
        mood: { $exists: true, $ne: '' }
      }).select('mood');

      if (entries.length === 0) return;

      // 3. Calculate average score
      let totalScore = 0;
      let validCount = 0;

      for (const entry of entries) {
        if (!entry.mood) continue;
        const score = this.getMoodScore(entry.mood);
        if (score > 0) {
          totalScore += score;
          validCount++;
        }
      }

      if (validCount === 0) return;

      const averageScore = Math.round(totalScore / validCount);
      const clampedScore = Math.min(5, Math.max(1, averageScore));

      // 4. Update Mood
      await moodService.upsertMood(userId, {
        date: date, // moodService normalizes this
        score: clampedScore,
        note: `Auto-calculated from ${validCount} entries`
      });

    } catch (err) {
      logger.error(`Error calculating daily mood for user ${userId}:`, err);
    }
  }

  // Get entry by ID
  async getEntryById(entryId: string, userId: string): Promise<IEntry> {
    try {
      const entry = await Entry.findOne({ _id: entryId, userId }).populate(['mentions', 'tags', 'media']);
      if (!entry) {
        throw createNotFoundError('Entry');
      }

      return entry;
    } catch (error) {
      logger.error('Get entry by ID failed:', error);
      throw error;
    }
  }

  // Get user entries
  async getUserEntries(userId: string, options: any = {}): Promise<{ entries: IEntry[]; total: number; page: number; limit: number; totalPages: number; }> {
    try {
      const { page, limit, skip } = Helpers.getPaginationParams(options);
      const sort = Helpers.getSortParams(options, 'createdAt');

      // Construct filter, excluding pagination/sort params
      const filter: any = {
        userId: typeof userId === 'string' && Types.ObjectId.isValid(userId)
          ? new Types.ObjectId(userId)
          : userId
      };

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
          .populate([
            { path: 'mentions' },
            { path: 'tags' },
            { path: 'media' }
          ])
          .sort(sort as any)
          .skip(skip)
          .limit(limit),
        Entry.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        entries,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error: any) {
      logger.error(`Get user entries failed for user ${userId}: ${error.message}`, error);
      throw error;
    }
  }

  // Search entries with Hybrid (Keyword + Semantic) support
  async searchEntries(userId: string, searchParams: EntrySearchRequest): Promise<{ entries: IEntry[]; total: number; page: number; limit: number; totalPages: number; }> {
    try {
      const mode = searchParams.mode || 'instant';

      // If q is empty, fallback to normal list search
      if (!searchParams.q?.trim()) {
        return this.getUserEntries(userId, searchParams);
      }

      if (mode === 'deep') {
        return this.performVectorSearch(userId, searchParams);
      }

      if (mode === 'hybrid') {
        return this.performHybridSearch(userId, searchParams);
      }

      // Default: instant/keyword mode
      return this.performKeywordSearch(userId, searchParams);
    } catch (error) {
      logger.error('Search entries failed:', error);
      throw error;
    }
  }

  // Tier 1: Fast Keyword Search
  private async performKeywordSearch(userId: string, searchParams: EntrySearchRequest): Promise<{ entries: IEntry[]; total: number; page: number; limit: number; totalPages: number; }> {
    const { page, limit, skip } = Helpers.getPaginationParams(searchParams);
    let sort: any = Helpers.getSortParams(searchParams, 'createdAt');

    const filter: any = { userId: new Types.ObjectId(userId) };
    const projection: any = {};

    if (searchParams.q) {
      const sanitizedQuery = Helpers.sanitizeSearchQuery(searchParams.q);
      if (sanitizedQuery) {
        filter.$text = { $search: sanitizedQuery };
        projection.score = { $meta: 'textScore' };
        sort = { score: { $meta: 'textScore' }, ...sort };
      }
    }

    this.applyFilters(filter, searchParams);

    const [entries, total] = await Promise.all([
      Entry.find(filter, projection)
        .populate(['mentions', 'tags', 'media'])
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Entry.countDocuments(filter),
    ]);

    return { entries, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // Tier 2: Semantic (Vector) Search
  private async performVectorSearch(userId: string, searchParams: EntrySearchRequest): Promise<{ entries: IEntry[]; total: number; page: number; limit: number; totalPages: number; }> {
    const { page, limit, skip } = Helpers.getPaginationParams(searchParams);

    if (!searchParams.q) return { entries: [], total: 0, page, limit, totalPages: 0 };

    // 1. Generate Embedding
    const queryVector = await LLMService.generateEmbeddings(searchParams.q);

    // 2. Aggregate Pipeline
    const pipeline: any[] = [
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embeddings",
          queryVector,
          numCandidates: 100,
          limit: 50,
          filter: { userId: new Types.ObjectId(userId) }
        }
      },
      {
        $addFields: { score: { $meta: "vectorSearchScore" } }
      }
    ];

    // 3. Filters
    const filter: any = {};
    this.applyFilters(filter, searchParams);
    if (Object.keys(filter).length > 0) {
      pipeline.push({ $match: filter });
    }

    // 4. Final results
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const entries = await Entry.aggregate(pipeline);
    await Entry.populate(entries, 'mentions tags media');

    if (entries.length === 0) {
      logger.info(`Semantic search returned 0 results for query: "${searchParams.q}"`);
    }

    return {
      entries,
      total: entries.length, // Vector search total is usually the result set size within limit
      page,
      limit,
      totalPages: 1
    };
  }

  // Tier 3: Hybrid (RRF) Search
  private async performHybridSearch(userId: string, searchParams: EntrySearchRequest): Promise<{ entries: IEntry[]; total: number; page: number; limit: number; totalPages: number; }> {
    const { page, limit } = Helpers.getPaginationParams(searchParams);

    // Run both in parallel
    const [keywordRes, vectorRes] = await Promise.all([
      this.performKeywordSearch(userId, { ...searchParams, limit: 50, page: 1, mode: 'instant' }),
      this.performVectorSearch(userId, { ...searchParams, limit: 50, page: 1, mode: 'deep' })
    ]);

    const mixedEntries = this.applyRRF(keywordRes.entries, vectorRes.entries, limit);

    return {
      entries: mixedEntries,
      total: mixedEntries.length,
      page,
      limit,
      totalPages: 1
    };
  }

  private applyFilters(filter: any, searchParams: EntrySearchRequest) {
    if (searchParams.type) filter.type = searchParams.type;

    if (searchParams.dateFrom || searchParams.dateTo) {
      const { from, to } = Helpers.getDateRange(searchParams.dateFrom, searchParams.dateTo);
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }

    if (searchParams.tags && searchParams.tags.length > 0) {
      filter.tags = { $in: searchParams.tags.map(id => new Types.ObjectId(id)) };
    }

    if (searchParams.entities && searchParams.entities.length > 0) {
      filter.mentions = { $in: searchParams.entities.map(id => new Types.ObjectId(id)) };
    }

    if (searchParams.isPrivate !== undefined) filter.isPrivate = searchParams.isPrivate;
    if (searchParams.isImportant !== undefined) filter.isImportant = searchParams.isImportant;
    if (searchParams.isFavorite !== undefined) filter.isFavorite = searchParams.isFavorite;
    if (searchParams.mood) filter.mood = new RegExp(searchParams.mood, 'i');
    if (searchParams.location) filter.location = new RegExp(searchParams.location, 'i');
  }

  private applyRRF(keywordResults: any[], vectorResults: any[], limit: number, k: number = 60): any[] {
    const scores: Record<string, { entry: any; score: number }> = {};

    keywordResults.forEach((entry, index) => {
      const id = entry._id.toString();
      const score = 1 / (k + index + 1);
      scores[id] = { entry, score };
    });

    vectorResults.forEach((entry, index) => {
      const id = entry._id.toString();
      const score = 1 / (k + index + 1);
      if (scores[id]) {
        scores[id].score += score;
      } else {
        scores[id] = { entry, score };
      }
    });

    return Object.values(scores)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.entry);
  }

  // Get feed with cursor-based pagination
  async getFeed(userId: string, feedParams: EntryFeedRequest): Promise<{ entries: IEntry[]; nextCursor?: string; hasMore: boolean; }> {
    try {
      const limit = Math.min(Math.max(1, feedParams.limit || 20), 50);
      const filter: any = { userId };

      if (feedParams.cursor) {
        const cursorEntry = await Entry.findById(feedParams.cursor);
        if (cursorEntry) {
          filter.$or = [
            { createdAt: { $lt: cursorEntry.createdAt } },
            {
              createdAt: cursorEntry.createdAt,
              _id: { $lt: cursorEntry._id }
            }
          ];
        }
      }

      if (feedParams.type) filter.type = feedParams.type;
      if (feedParams.tags && feedParams.tags.length > 0) {
        filter.tags = { $in: feedParams.tags.map((id: string) => new Types.ObjectId(id)) };
      }
      if (feedParams.entities && feedParams.entities.length > 0) {
        filter.mentions = { $in: feedParams.entities.map((id: string) => new Types.ObjectId(id)) };
      }
      if (feedParams.isPrivate !== undefined) filter.isPrivate = feedParams.isPrivate;
      if (feedParams.isImportant !== undefined) filter.isImportant = feedParams.isImportant;
      if (feedParams.mood) filter.mood = new RegExp(feedParams.mood, 'i');

      const entries = await Entry.find(filter)
        .populate(['mentions', 'tags', 'media'])
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1);

      const hasMore = entries.length > limit;
      let nextCursor = undefined;

      if (hasMore) {
        entries.pop();
        nextCursor = entries[entries.length - 1]._id.toString();
      }

      return { entries, nextCursor, hasMore };
    } catch (error) {
      logger.error('Get feed failed:', error);
      throw error;
    }
  }

  // Update entry
  async updateEntry(entryId: string, userId: string, updateData: UpdateEntryRequest): Promise<IEntry> {
    try {
      const existingEntry = await Entry.findOne({ _id: entryId, userId });
      if (!existingEntry) throw createNotFoundError('Entry');

      const oldTags = (existingEntry.tags || []).map(t => t.toString());

      if (updateData.tags) {
        const resolvedTagIds: string[] = [];
        for (const tagIdentifier of updateData.tags) {
          if (Types.ObjectId.isValid(tagIdentifier)) {
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

      if (!entry) throw createNotFoundError('Entry');

      if (updateData.tags) {
        const newTags = updateData.tags;
        const addedTags = newTags.filter((t: string) => !oldTags.includes(t));
        const removedTags = oldTags.filter((t: string) => !newTags.includes(t));

        if (addedTags.length > 0) await tagService.incrementUsage(userId, addedTags);
        if (removedTags.length > 0) await tagService.decrementUsage(userId, removedTags);
      }

      // Background Task: Update Daily Mood based on entries
      // Fire and forget - do not await
      this.updateDailyMood(userId, entry.date || new Date())
        .catch(err => logger.error('Failed to auto-update daily mood', err));

      return entry;
    } catch (error) {
      logger.error('Entry update failed:', error);
      throw error;
    }
  }

  // Delete entry
  async deleteEntry(entryId: string, userId: string): Promise<void> {
    try {
      const entry = await Entry.findOneAndDelete({ _id: entryId, userId });
      if (!entry) throw createNotFoundError('Entry');

      if (entry.tags && entry.tags.length > 0) {
        const tagIds = entry.tags.map(t => t.toString());
        await tagService.decrementUsage(userId, tagIds);
      }

      return;
    } catch (error) {
      logger.error('Entry deletion failed:', error);
      throw error;
    }
  }

  // Get entry statistics
  async getEntryStats(userId: string): Promise<EntryStats> {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [totalEntries, entriesToday, entriesThisWeek, entriesThisMonth, entryTypes, averageWords, mostActiveDayData] = await Promise.all([
        Entry.countDocuments({ userId }),
        Entry.countDocuments({ userId, createdAt: { $gte: startOfDay } }),
        Entry.countDocuments({ userId, createdAt: { $gte: startOfWeek } }),
        Entry.countDocuments({ userId, createdAt: { $gte: startOfMonth } }),
        Entry.aggregate([{ $match: { userId: new Types.ObjectId(userId) } }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
        Entry.aggregate([{ $match: { userId: new Types.ObjectId(userId) } }, { $project: { wordCount: { $size: { $split: ['$content', ' '] } } } }, { $group: { _id: null, avgWords: { $avg: '$wordCount' } } }]),
        Entry.aggregate([{ $match: { userId: new Types.ObjectId(userId) } }, { $group: { _id: { $dayOfWeek: '$createdAt' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 1 }])
      ]);

      const typeStats = { text: 0, media: 0, mixed: 0 };
      entryTypes.forEach((type: any) => { typeStats[type._id as keyof typeof typeStats] = type.count; });

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const mostActiveDay = mostActiveDayData[0] ? dayNames[mostActiveDayData[0]._id - 1] : 'Unknown';

      return {
        totalEntries,
        entriesThisMonth,
        entriesThisWeek,
        entriesToday,
        averageWordsPerEntry: Math.round(averageWords[0]?.avgWords || 0),
        mostActiveDay,
        entryTypes: typeStats
      };
    } catch (error) {
      logger.error('Get entry stats failed:', error);
      throw error;
    }
  }

  // Toggle favorite status
  async toggleFavorite(entryId: string, userId: string): Promise<IEntry> {
    try {
      const entry = await Entry.findOne({ _id: entryId, userId });
      if (!entry) throw createNotFoundError('Entry');
      entry.isFavorite = !entry.isFavorite;
      await entry.save();
      return entry;
    } catch (error) {
      logger.error('Toggle favorite failed:', error);
      throw error;
    }
  }

  // Get calendar entries
  async getCalendarEntries(userId: string, startDate: string, endDate: string): Promise<any[]> {
    try {
      return await Entry.find({
        userId,
        date: { $gte: new Date(startDate), $lte: new Date(endDate) }
      }).select('date mood type isImportant isFavorite title').sort({ date: 1 });
    } catch (error) {
      logger.error('Get calendar entries failed:', error);
      throw error;
    }
  }

  // Delete all user data (Cascade Delete)
  async deleteUserData(userId: string): Promise<number> {
    const result = await Entry.deleteMany({ userId });
    logger.info(`Deleted ${result.deletedCount} entries for user ${userId}`);
    return result.deletedCount || 0;

  }

  // Self-Healing: Process entries that missed AI tagging/processing
  async selfHealEntries(limit: number = 10): Promise<number> {
    try {
      const untaggedEntries = await Entry.find({
        aiProcessed: { $ne: true },
        content: { $exists: true, $ne: '' },
        $expr: { $gt: [{ $strLenCP: "$content" }, 20] } // only meaningful entries
      })
        .sort({ createdAt: -1 })
        .limit(limit);

      if (untaggedEntries.length === 0) return 0;

      logger.info(`Self-Healing: Found ${untaggedEntries.length} untagged entries. Processing...`);

      const { runEntryTagging } = await import('../agent/workflows/tagging.workflow');

      let successCount = 0;
      for (const entry of untaggedEntries) {
        try {
          await runEntryTagging(entry.userId.toString(), {
            entryId: entry._id.toString(),
            content: entry.content
          });
          successCount++;
        } catch (err) {
          logger.error(`Self-Healing failed for entry ${entry._id}:`, err);
        }
      }

      return successCount;
    } catch (error) {
      logger.error('Self-healing entries failed:', error);
      return 0;
    }
  }
}

export const entryService = new EntryService();
export default entryService;
