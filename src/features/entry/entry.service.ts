import mongoose, { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { ApiError } from '../../core/errors/api.error';
import { LLMService } from '../../core/llm/llm.service';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import { MongoUtil } from '../../shared/utils/mongo.utils';
import { PaginationUtil } from '../../shared/utils/pagination.utils';
import { StringUtil } from '../../shared/utils/string.utils';
import { AgentTask } from '../agent/agent.model';
import collectionService from '../collection/collection.service';
import { EnrichedEntry } from '../enrichment/models/enriched-entry.model';
import { GraphEdge } from '../graph/edge.model';
import { tagService } from '../tag/tag.service';
import { transcribeAudioEntry } from './audio-transcription.service';
import { IEntryService } from './entry.interfaces';
import { Entry } from './entry.model';
import { CreateEntryRequest, EntryStats, GetEntriesRequest, GetEntriesResponse, IEntry, UpdateEntryRequest } from "./entry.types";

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

      // 2. Resolve Tags (handle both IDs and Names)
      const resolvedTagIds: Types.ObjectId[] = [];
      if (entryData.tags && entryData.tags.length > 0) {
        for (const tagIdentifier of entryData.tags) {
          if (MongoUtil.isValidObjectId(tagIdentifier)) {
            resolvedTagIds.push(new Types.ObjectId(tagIdentifier));
          } else {
            const tag = await tagService.findOrCreateTag(userId, tagIdentifier);
            resolvedTagIds.push(tag._id as Types.ObjectId);
          }
        }
      }

      // 3. Create Entry object
      let entry: any = new Entry({  // here any is EntryInstance or EntryObject
        userId: new Types.ObjectId(userId),
        ...entryData,
        tags: resolvedTagIds,
        media: entryData.media?.map(id => new Types.ObjectId(id)),
        collectionId: entryData.collectionId ? new Types.ObjectId(entryData.collectionId) : undefined,
      });

      await entry.save();

      if (entryData.collectionId) {
        await collectionService.incrementEntryCount(entryData.collectionId);
      }

      // Update tag usage counts if we resolved any tags
      if (resolvedTagIds.length > 0) {
        await tagService.incrementUsage(userId, resolvedTagIds.map(t => t.toString()));
      }

      await entry.populate(['tags', 'media', 'collectionId']);

      entry = entry.toObject();

      // If the entry contains audio media, kick off async transcription.
      // The entry is already in 'processing' status from the model default when media is attached.
      const hasAudioMedia = (entry.media as any[]).some((m: any) => m?.type === 'audio');
      if (hasAudioMedia) {
        setImmediate(() => transcribeAudioEntry(entry._id.toString(), userId.toString()));
      }

      return entry;
    } catch (error) {
      logger.error('Entry creation failed:', error);
      throw error;
    }
  }

  // Fetch a single entry by ID with populated relations
  async getEntryById(entryId: string, userId: string | Types.ObjectId): Promise<IEntry> {
    const entry = await Entry.findOne({ _id: entryId, userId }).populate(['tags', 'media', 'collectionId']).lean();
    if (!entry) throw ApiError.notFound('Entry');
    const enrichedEntries = await this.attachEnrichedData([entry], userId);
    return enrichedEntries[0] as IEntry;
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
          .populate(['tags', 'media', 'collectionId'])
          .sort({ isPinned: -1, createdAt: -1, _id: -1 })
          .limit(limit + 1)
          .lean();

        const hasMore = entries.length > limit;
        if (hasMore) entries.pop();
        const nextCursor = entries.length > 0 ? entries[entries.length - 1]._id.toString() : undefined;

        const populatedEntries = await this.attachEnrichedData(entries, userId);
        return { entries: populatedEntries as any, nextCursor, hasMore };
      }

      // OFFSET-BASED (Classic Search/Grid)
      const { page, skip } = PaginationUtil.getPaginationParams(options);
      let sort = PaginationUtil.getSortParams(options, 'createdAt');
      // Always prioritize pinned entries in standard sorting
      if (typeof sort === 'object' && !options.q) {
        sort = { isPinned: -1, ...sort } as any;
      }
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
          .populate(['tags', 'media', 'collectionId'])
          .sort(sort as any)
          .skip(skip)
          .limit(limit)
          .lean(),
        Entry.countDocuments(filter),
      ]);

      const populatedEntries = await this.attachEnrichedData(entries, userId);

      return {
        entries: populatedEntries,
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

  private async attachEnrichedData(entries: any[], userId: string | Types.ObjectId): Promise<any[]> {
    if (!entries || entries.length === 0) return entries;

    const entryIds = entries.map(e => e._id);
    const enrichedEntries = await EnrichedEntry.find({
      referenceId: { $in: entryIds },
      userId: new Types.ObjectId(userId)
    }).select('referenceId metadata narrative extraction').lean();

    const enrichedMap = new Map();
    enrichedEntries.forEach((ee: any) => {
      if (ee.referenceId) {
        enrichedMap.set(ee.referenceId.toString(), {
          metadata: ee.metadata,
          narrative: ee.narrative,
          extraction: ee.extraction
        });
      }
    });

    return entries.map(entry => {
      const enrichment = enrichedMap.get(entry._id.toString());
      if (enrichment) {
        entry.enrichment = enrichment;
      }
      return entry;
    });
  }

  // Internal helper for semantic lookup
  private async performVectorSearch(userId: string | Types.ObjectId, options: GetEntriesRequest): Promise<any> {
    const { limit, skip } = PaginationUtil.getPaginationParams(options);
    const queryVector = await LLMService.generateEmbeddings(options.q!, { workflow: 'search', userId });

    const pipeline: any[] = [
      {
        $vectorSearch: {
          index: "enriched_vector_index", // Switch to enriched index
          path: "embedding", // Embedding field in EnrichedEntry
          queryVector,
          numCandidates: 100,
          limit: 50,
          filter: { userId: new Types.ObjectId(userId) }
        }
      },
      // Resolve reference to actual entry
      {
        $lookup: {
          from: "entries",
          localField: "referenceId",
          foreignField: "_id",
          as: "entry"
        }
      },
      { $unwind: "$entry" },
      { $replaceRoot: { newRoot: { $mergeObjects: ["$entry", { score: { $meta: "vectorSearchScore" } }, { metadata: { $mergeObjects: ["$entry.metadata", "$metadata"] } }] } } }
    ];

    const filter: any = {};
    this.applyQueryFilters(filter, options);
    if (Object.keys(filter).length > 1) pipeline.push({ $match: filter });

    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const entries = await Entry.aggregate(pipeline);
    await Entry.populate(entries, {
      path: 'tags media',
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

  private applyQueryFilters(filter: any, options: GetEntriesRequest) {
    if (options.type) filter.type = options.type;
    if (options.isFavorite !== undefined) filter.isFavorite = options.isFavorite;
    if (options.isImportant !== undefined) filter.isImportant = options.isImportant;
    if (options.isPinned !== undefined) filter.isPinned = options.isPinned;
    if (options.isPrivate !== undefined) filter.isPrivate = options.isPrivate;
    if (options.kind) filter.kind = options.kind;
    if (options.collectionId) filter.collectionId = new Types.ObjectId(options.collectionId);
    if (options.location) filter.location = new RegExp(options.location, 'i');

    if (options.dateFrom || options.dateTo) {
      filter.date = {};
      if (options.dateFrom) filter.date.$gte = new Date(options.dateFrom);
      if (options.dateTo) filter.date.$lte = new Date(options.dateTo);
    }

    if (options.tags && options.tags.length > 0) {
      filter.tags = { $in: options.tags.map((id: string) => new Types.ObjectId(id)) };
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
      const oldCollectionId = existingEntry.collectionId?.toString();

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
            collectionId: updateData.collectionId ? new Types.ObjectId(updateData.collectionId) : existingEntry.collectionId,
            isEdited: true
          }
        },
        { new: true, runValidators: true }
      ).populate(['tags', 'media', 'collectionId']);

      if (!entry) throw ApiError.notFound('Entry');

      // Update collection counts if collectionId changed
      if (updateData.collectionId !== undefined && updateData.collectionId !== oldCollectionId) {
        if (oldCollectionId) await collectionService.decrementEntryCount(oldCollectionId);
        if (updateData.collectionId) await collectionService.incrementEntryCount(updateData.collectionId);
      }

      if (updateData.tags) {
        const newTags = updateData.tags;
        const addedTags = newTags.filter((t: string) => !oldTags.includes(t));
        const removedTags = oldTags.filter((t: string) => !newTags.includes(t));

        if (addedTags.length > 0) await tagService.incrementUsage(userId, addedTags);
        if (removedTags.length > 0) await tagService.decrementUsage(userId, removedTags);
      }

      const enrichedEntries = await this.attachEnrichedData([entry.toObject()], userId);
      const finalEntry = enrichedEntries[0];

      socketService.emitToUser(userId.toString(), SocketEvents.ENTRY_UPDATED, finalEntry);
      return finalEntry as IEntry;
    } catch (error) {
      logger.error('Entry update failed:', error);
      throw error;
    }
  }

  // Delete entry and update tag usage metrics with optional transaction support
  async deleteEntry(entryId: string, userId: string | Types.ObjectId): Promise<IEntry> {
    const useTransactions = await MongoUtil.supportsTransactions();
    let session: mongoose.ClientSession | null = null;

    if (useTransactions) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    try {
      const entry = await Entry.findOneAndDelete({ _id: entryId, userId }).session(session);
      if (!entry) throw ApiError.notFound('Entry');

      // ACID: Cascade delete associated documents
      await EnrichedEntry.deleteMany({ referenceId: entryId, userId }).session(session);
      await GraphEdge.deleteMany({
        $or: [{ sourceEntryId: entryId }, { targetEntryId: entryId }]
      }).session(session);
      await AgentTask.deleteMany({ userId, 'inputData.entryId': entryId }).session(session);

      if (session) {
        await session.commitTransaction();
      }

      // Statistics updates (run after successful commit)
      try {
        if (entry.tags && entry.tags.length > 0) {
          const tagIds = entry.tags.map(t => t.toString());
          await tagService.decrementUsage(userId, tagIds);
        }

        if (entry.collectionId) {
          await collectionService.decrementEntryCount(entry.collectionId.toString());
        }
      } catch (statError) {
        logger.error('Failed to update stats after entry deletion:', statError);
      }

      return entry as IEntry;
    } catch (error) {
      if (session) {
        await session.abortTransaction();
      }
      logger.error('Entry deletion failed:', error);
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  // Toggle favorite status of an entry
  async toggleFavorite(entryId: string, userId: string | Types.ObjectId): Promise<IEntry> {
    const entry = await Entry.findOne({ _id: entryId, userId });
    if (!entry) throw ApiError.notFound('Entry');
    entry.isFavorite = !entry.isFavorite;
    await entry.save();

    // We attach enriched data before returning
    const enrichedEntries = await this.attachEnrichedData([entry.toObject()], userId);
    return enrichedEntries[0] as IEntry;
  }

  // Toggle pin status of an entry
  async togglePin(entryId: string, userId: string | Types.ObjectId): Promise<IEntry> {
    const entry = await Entry.findOne({ _id: entryId, userId });
    if (!entry) throw ApiError.notFound('Entry');
    entry.isPinned = !entry.isPinned;
    await entry.save();
    const enrichedEntries = await this.attachEnrichedData([entry.toObject()], userId);
    const finalEntry = enrichedEntries[0];
    socketService.emitToUser(userId.toString(), SocketEvents.ENTRY_UPDATED, finalEntry);
    return finalEntry as IEntry;
  }

  async getCalendarEntries(userId: string | Types.ObjectId, startDate: string, endDate: string): Promise<any[]> {
    return Entry.find({
      userId,
      date: { $gte: new Date(startDate), $lte: new Date(endDate) }
    }).select('date type isImportant isFavorite title').sort({ date: 1 });
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

      return stuckEntries.length;
    } catch (error) {
      logger.error('Self-healing entries failed', error);
      return 0;
    }
  }
}

export const entryService = new EntryService();
export default entryService;
