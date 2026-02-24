import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { ApiError } from '../../core/errors/api.error';
import { LLMService } from '../../core/llm/llm.service';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import { MongoUtil } from '../../shared/utils/mongo.utils';
import { PaginationUtil } from '../../shared/utils/pagination.utils';
import { StringUtil } from '../../shared/utils/string.utils';
import { taggingWorkflow } from '../agent/workflows/tagging.workflow';
import { moodService } from '../mood/mood.service';
import { tagService } from '../tag/tag.service';
import { CreateEntryRequest, EntryStats, GetEntriesRequest, GetEntriesResponse, IEntry, IEntryService, UpdateEntryRequest } from './entry.interfaces';
import { Entry } from './entry.model';
import { classifyMood } from './mood.config';

export class EntryService implements IEntryService {

  // Create new entry with core persistence logic and deduplication
  async createEntry(userId: string | Types.ObjectId, entryData: CreateEntryRequest): Promise<IEntry> {
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

      // 2. Create Entry object
      const entry = new Entry({
        userId: new Types.ObjectId(userId),
        ...entryData,
        // Ensure ObjectIds
        mentions: entryData.mentions?.map(id => new Types.ObjectId(id)),
        tags: entryData.tags?.map(id => new Types.ObjectId(id)),
        media: entryData.media?.map(id => new Types.ObjectId(id)),
        moodMetadata: entryData.mood ? classifyMood(entryData.mood) : undefined,
      });

      await entry.save();
      await entry.populate(['mentions', 'tags', 'media']);

      return entry;
    } catch (error) {
      logger.error('Entry creation failed:', error);
      throw error;
    }
  }

  // Fetch a single entry by ID with populated relations
  async getEntryById(entryId: string, userId: string | Types.ObjectId): Promise<IEntry> {
    const entry = await Entry.findOne({ _id: entryId, userId }).populate(['mentions', 'tags', 'media']);
    if (!entry) throw ApiError.notFound('Entry');
    return entry;
  }

  /**
   * Comprehensive entry listing and search with support for:
   * - Offset pagination (Search/Grid)
   * - Cursor pagination (Infinite Feed)
   * - Vector Search (Semantic/Deep)
   * - Hybrid Search (RRF)
   */
  async getEntries(userId: string | Types.ObjectId, options: GetEntriesRequest): Promise<GetEntriesResponse> {
    try {
      const limit = Math.min(Math.max(1, options.limit || 20), 100);
      const userObjectId = new Types.ObjectId(userId);
      const mode = options.mode || (options.q ? 'instant' : 'feed');

      // 1. SEMANTIC SEARCH (DEEP)
      if (mode === 'deep' && options.q) {
        return this.performVectorSearch(userId, options);
      }

      // 2. HYBRID SEARCH
      if (mode === 'hybrid' && options.q) {
        return this.performHybridSearch(userId, options);
      }

      // 3. KEYWORD/FEED SEARCH
      const filter: any = { userId: userObjectId };
      this.applyQueryFilters(filter, options);

      // CURSOR-BASED (Stable Feed)
      if (options.cursor || mode === 'feed') {
        if (options.cursor) {
          const cursorEntry = await Entry.findById(options.cursor).select('createdAt');
          if (cursorEntry) {
            filter.$or = [
              { createdAt: { $lt: cursorEntry.createdAt } },
              { createdAt: cursorEntry.createdAt, _id: { $lt: cursorEntry._id } }
            ];
          }
        }

        const entries = await Entry.find(filter)
          .populate(['mentions', 'tags', 'media'])
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit + 1)
          .lean();

        const hasMore = entries.length > limit;
        if (hasMore) entries.pop();
        const nextCursor = entries.length > 0 ? entries[entries.length - 1]._id.toString() : undefined;

        return { entries: entries as any, nextCursor, hasMore };
      }

      // OFFSET-BASED (Classic Search/Grid)
      const { page, skip } = PaginationUtil.getPaginationParams(options);
      let sort = PaginationUtil.getSortParams(options, 'createdAt');
      const projection: any = {};

      if (options.q && mode === 'instant') {
        const sanitized = StringUtil.sanitizeSearchQuery(options.q);
        if (sanitized) {
          filter.$text = { $search: sanitized };
          projection.score = { $meta: 'textScore' };
          sort = { score: { $meta: 'textScore' }, ...sort } as any;
        }
      }

      const [entries, total] = await Promise.all([
        Entry.find(filter, projection)
          .populate(['mentions', 'tags', 'media'])
          .sort(sort as any)
          .skip(skip)
          .limit(limit)
          .lean(),
        Entry.countDocuments(filter),
      ]);

      return {
        entries,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error(`Get entries failed for user ${userId}`, error);
      throw error;
    }
  }

  // Internal helper for semantic lookup
  private async performVectorSearch(userId: string | Types.ObjectId, options: GetEntriesRequest): Promise<any> {
    const { limit, skip } = PaginationUtil.getPaginationParams(options);
    const queryVector = await LLMService.generateEmbeddings(options.q!, { workflow: 'search', userId });

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
      { $addFields: { score: { $meta: "vectorSearchScore" } } }
    ];

    const filter: any = {};
    this.applyQueryFilters(filter, options);
    if (Object.keys(filter).length > 1) pipeline.push({ $match: filter });

    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const entries = await Entry.aggregate(pipeline);
    await Entry.populate(entries, {
      path: 'mentions tags media',
      model: 'Entry'
    });

    return { entries, total: entries.length, page: options.page || 1, limit, totalPages: 1 };
  }

  // Internal helper for Hybrid (RRF)
  private async performHybridSearch(userId: string | Types.ObjectId, options: GetEntriesRequest): Promise<any> {
    const limit = options.limit || 20;
    const [keywordRes, vectorRes] = await Promise.all([
      this.getEntries(userId, { ...options, mode: 'instant', limit: 50 }),
      this.performVectorSearch(userId, { ...options, limit: 50 }).catch(() => ({ entries: [] }))
    ]);

    const k = 60;
    const scores: Record<string, { entry: any; score: number }> = {};
    const processResults = (results: any[]) => {
      results.forEach((entry, index) => {
        const id = entry._id.toString();
        const score = 1 / (k + index + 1);
        if (scores[id]) scores[id].score += score;
        else scores[id] = { entry, score };
      });
    };

    processResults(keywordRes.entries);
    processResults(vectorRes.entries);

    const entries = Object.values(scores)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.entry);

    return { entries, total: entries.length, page: options.page || 1, limit, totalPages: 1 };
  }

  // Unified logic for applying search filters
  private applyQueryFilters(filter: any, options: GetEntriesRequest) {
    if (options.type) filter.type = options.type;
    if (options.mood) filter.mood = new RegExp(options.mood, 'i');
    if (options.isFavorite !== undefined) filter.isFavorite = options.isFavorite;
    if (options.isImportant !== undefined) filter.isImportant = options.isImportant;
    if (options.isPrivate !== undefined) filter.isPrivate = options.isPrivate;
    if (options.kind) filter.kind = options.kind;
    if (options.location) filter.location = new RegExp(options.location, 'i');

    if (options.dateFrom || options.dateTo) {
      filter.date = {};
      if (options.dateFrom) filter.date.$gte = new Date(options.dateFrom);
      if (options.dateTo) filter.date.$lte = new Date(options.dateTo);
    }

    if (options.tags && options.tags.length > 0) {
      filter.tags = { $in: options.tags.map((id: string) => new Types.ObjectId(id)) };
    }

    if (options.entities && options.entities.length > 0) {
      filter.mentions = { $in: options.entities.map((id: string) => new Types.ObjectId(id)) };
    }
  }

  // Placeholder for searchEntries (renamed/absorbed)
  async searchEntries(userId: string | Types.ObjectId, searchParams: GetEntriesRequest) {
    return this.getEntries(userId, searchParams);
  }

  // Generates a comprehensive statistical overview of user entries.
  async getEntryStats(userId: string | Types.ObjectId): Promise<EntryStats> {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const userObjectId = new Types.ObjectId(userId);

      const [
        totalEntries,
        entriesToday,
        entriesThisWeek,
        entriesThisMonth,
        entryTypes,
        averageWords,
        mostActiveDayData
      ] = await Promise.all([
        Entry.countDocuments({ userId: userObjectId }),
        Entry.countDocuments({ userId: userObjectId, createdAt: { $gte: startOfDay } }),
        Entry.countDocuments({ userId: userObjectId, createdAt: { $gte: startOfWeek } }),
        Entry.countDocuments({ userId: userObjectId, createdAt: { $gte: startOfMonth } }),
        Entry.aggregate([
          { $match: { userId: userObjectId } },
          { $group: { _id: '$type', count: { $sum: 1 } } }
        ]),
        Entry.aggregate([
          { $match: { userId: userObjectId } },
          { $project: { wordCount: { $size: { $split: ['$content', ' '] } } } },
          { $group: { _id: null, avgWords: { $avg: '$wordCount' } } }
        ]),
        Entry.aggregate([
          { $match: { userId: userObjectId } },
          { $group: { _id: { $dayOfWeek: '$createdAt' }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 1 }
        ])
      ]);

      const typeStats = { text: 0, media: 0, mixed: 0 };
      entryTypes.forEach((type: any) => {
        if (type._id in typeStats) typeStats[type._id as keyof typeof typeStats] = type.count;
      });

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

  // Update entry and re-trigger mood calculation if needed
  async updateEntry(entryId: string, userId: string | Types.ObjectId, updateData: UpdateEntryRequest): Promise<IEntry> {
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

      socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, entry);
      return entry;
    } catch (error) {
      logger.error('Entry update failed:', error);
      throw error;
    }
  }

  // Delete entry and update tag usage metrics
  async deleteEntry(entryId: string, userId: string | Types.ObjectId): Promise<void> {
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

  // Toggle favorite status of an entry
  async toggleFavorite(entryId: string, userId: string | Types.ObjectId): Promise<IEntry> {
    const entry = await Entry.findOne({ _id: entryId, userId });
    if (!entry) throw ApiError.notFound('Entry');
    entry.isFavorite = !entry.isFavorite;
    await entry.save();
    return entry;
  }

  // Minimal data fetch for calendar views
  async getCalendarEntries(userId: string | Types.ObjectId, startDate: string, endDate: string): Promise<any[]> {
    return Entry.find({
      userId,
      date: { $gte: new Date(startDate), $lte: new Date(endDate) }
    }).select('date mood type isImportant isFavorite title').sort({ date: 1 });
  }

  // Cascade delete all user entries
  async deleteUserData(userId: string | Types.ObjectId): Promise<number> {
    const result = await Entry.deleteMany({ userId });
    logger.info(`Deleted ${result.deletedCount} entries for user ${userId}`);
    return result.deletedCount || 0;
  }

  // Self-Healing: Process entries that missed AI processing
  async selfHealEntries(limit: number = 10): Promise<number> {
    try {
      // Heal stuck "processing" entries (> 5 mins old)
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
      const stuckEntries = await Entry.find({
        status: 'processing',
        updatedAt: { $lt: fiveMinsAgo }
      });
      for (const entry of stuckEntries) {
        entry.status = 'failed';
        entry.metadata = { ...entry.metadata, processingStep: 'timeout', error: 'AI processing timed out' };
        await entry.save();
        socketService.emitToUser(entry.userId.toString(), SocketEvents.ENTRY_UPDATED, entry);
      }

      const untaggedEntries = await Entry.find({
        aiProcessed: { $ne: true },
        content: { $exists: true, $ne: '' },
        $expr: { $gt: [{ $strLenCP: "$content" }, 20] }
      }).sort({ createdAt: -1 }).limit(limit);

      if (untaggedEntries.length === 0) return 0;

      let successCount = 0;
      for (const entry of untaggedEntries) {
        try {
          await taggingWorkflow.execute({
            userId: entry.userId,
            inputData: {
              entryId: entry._id.toString(),
              content: entry.content
            }
          } as any);
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
