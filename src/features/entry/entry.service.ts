import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { createNotFoundError } from '../../core/middleware/errorHandler';
import { Helpers } from '../../shared/helpers';
import { personService } from '../person/person.service';
import { tagService } from '../tag/tag.service';
import {
  CreateEntryRequest,
  EntryFeedRequest,
  EntrySearchRequest,
  EntryStats,
  IEntry,
  IEntryService,
  UpdateEntryRequest
} from './entry.interfaces';
import { Entry } from './entry.model';

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
      // Extract mentions from content
      const mentionNames = this.extractMentions(entryData.content || '');

      // Auto-create or find persons for mentions
      const mentionIds: Types.ObjectId[] = [];
      for (const name of mentionNames) {
        const person = await personService.findOrCreatePerson(userId, name);
        mentionIds.push(person._id as Types.ObjectId);
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
      });

      await entry.save();
      await entry.populate(['mentions', 'tags', 'media']);

      // Increment tag usage
      if (explicitTags.length > 0) {
        await tagService.incrementUsage(userId, explicitTags);
      }

      // Increment Person Interaction Count
      if (mentionIds.length > 0) {
        const { Person } = await import('../person/person.model');
        await Person.updateMany(
          { _id: { $in: mentionIds } },
          {
            $inc: { interactionCount: 1 },
            $set: { lastInteractionAt: new Date() }
          }
        );
      }

      logger.info('Entry created successfully', {
        entryId: entry._id,
        userId,
        mentionsCount: mentionIds.length,
        tagsCount: tagIds.length,
      });

      // TRIGGER AGENT: Auto-Tagging & People Extraction
      if (entryData.content && entryData.content.length > 20) {
        Promise.all([
          import('../agent/agent.service'),
          import('../agent/agent.types')
        ]).then(([{ agentService }, { AgentTaskType }]) => {
          agentService.createTask(userId, AgentTaskType.ENTRY_TAGGING, {
            entryId: entry._id.toString(),
            content: entryData.content
          }).catch(err => logger.error('Failed to trigger auto-tagging', err));

          agentService.createTask(userId, AgentTaskType.PEOPLE_EXTRACTION, {
            entryId: entry._id.toString(),
            userId
          }).catch(err => logger.error('Failed to trigger people extraction', err));

          agentService.createTask(userId, AgentTaskType.EMBED_ENTRY, {
            entryId: entry._id.toString()
          }).catch(err => logger.error('Failed to trigger entry embedding', err));
        });
      }

      return entry;
    } catch (error) {
      logger.error('Entry creation failed:', error);
      throw error;
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
          .populate(['mentions', 'tags', 'media'])
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
    } catch (error) {
      logger.error('Get user entries failed:', error);
      throw error;
    }
  }

  // Search entries
  async searchEntries(userId: string, searchParams: EntrySearchRequest): Promise<{ entries: IEntry[]; total: number; page: number; limit: number; totalPages: number; }> {
    try {
      const { page, limit, skip } = Helpers.getPaginationParams(searchParams);
      let sort: any = Helpers.getSortParams(searchParams, 'createdAt');

      const filter: any = { userId };
      const projection: any = {};

      if (searchParams.q) {
        const sanitizedQuery = Helpers.sanitizeSearchQuery(searchParams.q);
        if (sanitizedQuery) {
          filter.$text = { $search: sanitizedQuery };
          projection.score = { $meta: 'textScore' };
          sort = { score: { $meta: 'textScore' }, ...sort };
        }
      }

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

      if (searchParams.people && searchParams.people.length > 0) {
        filter.mentions = { $in: searchParams.people.map(id => new Types.ObjectId(id)) };
      }

      if (searchParams.isPrivate !== undefined) filter.isPrivate = searchParams.isPrivate;
      if (searchParams.isImportant !== undefined) filter.isImportant = searchParams.isImportant;
      if (searchParams.mood) filter.mood = new RegExp(searchParams.mood, 'i');
      if (searchParams.location) filter.location = new RegExp(searchParams.location, 'i');

      const [entries, total] = await Promise.all([
        Entry.find(filter, projection)
          .populate(['mentions', 'tags', 'media'])
          .sort(sort)
          .skip(skip)
          .limit(limit),
        Entry.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limit);

      return { entries, total, page, limit, totalPages };
    } catch (error) {
      logger.error('Search entries failed:', error);
      throw error;
    }
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
      if (feedParams.people && feedParams.people.length > 0) {
        filter.mentions = { $in: feedParams.people.map((id: string) => new Types.ObjectId(id)) };
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
        { $set: { ...updateData, isEdited: true } },
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
}

export const entryService = new EntryService();
export default entryService;
