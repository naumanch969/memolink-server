import { Entry } from './entry.model';
import { logger } from '../../config/logger';
import { createNotFoundError } from '../../core/middleware/errorHandler';
import { EntrySearchRequest, EntryStats, IEntryService } from './entry.interfaces';
import { Helpers } from '../../shared/helpers';
import { Types } from 'mongoose';
import { IEntry } from '../../shared/types';

export class EntryService implements IEntryService {
  // Create new entry
  async createEntry(userId: string, entryData: any): Promise<IEntry> {
    try {
      const entry = new Entry({
        userId: new Types.ObjectId(userId),
        ...entryData,
      });

      await entry.save();
      await entry.populate(['mentions', 'tags', 'media']);

      logger.info('Entry created successfully', {
        entryId: entry._id,
        userId,
      });

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
  async getUserEntries(userId: string, options: any = {}): Promise<{
    entries: IEntry[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const { page, limit, skip } = Helpers.getPaginationParams(options);
      const sort = Helpers.getSortParams(options, 'createdAt');

      const filter = { userId, ...options.filter };

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
  async searchEntries(userId: string, searchParams: EntrySearchRequest): Promise<{
    entries: IEntry[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const { page, limit, skip } = Helpers.getPaginationParams(searchParams);
      const sort = Helpers.getSortParams(searchParams, 'createdAt');

      const filter: any = { userId };

      // Text search
      if (searchParams.q) {
        const sanitizedQuery = Helpers.sanitizeSearchQuery(searchParams.q);
        filter.$text = { $search: sanitizedQuery };
      }

      // Type filter
      if (searchParams.type) {
        filter.type = searchParams.type;
      }

      // Date range filter
      if (searchParams.dateFrom || searchParams.dateTo) {
        const { from, to } = Helpers.getDateRange(searchParams.dateFrom, searchParams.dateTo);
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = from;
        if (to) filter.createdAt.$lte = to;
      }

      // Tags filter
      if (searchParams.tags && searchParams.tags.length > 0) {
        filter.tags = { $in: searchParams.tags.map(id => new Types.ObjectId(id)) };
      }

      // People filter
      if (searchParams.people && searchParams.people.length > 0) {
        filter.mentions = { $in: searchParams.people.map(id => new Types.ObjectId(id)) };
      }

      // Privacy filter
      if (searchParams.isPrivate !== undefined) {
        filter.isPrivate = searchParams.isPrivate;
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
      logger.error('Search entries failed:', error);
      throw error;
    }
  }

  // Update entry
  async updateEntry(entryId: string, userId: string, updateData: any): Promise<IEntry> {
    try {
      const entry = await Entry.findOneAndUpdate(
        { _id: entryId, userId },
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate(['mentions', 'tags', 'media']);

      if (!entry) {
        throw createNotFoundError('Entry');
      }

      logger.info('Entry updated successfully', {
        entryId: entry._id,
        userId,
      });

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
      if (!entry) {
        throw createNotFoundError('Entry');
      }

      logger.info('Entry deleted successfully', {
        entryId: entry._id,
        userId,
      });
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
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        totalEntries,
        entriesToday,
        entriesThisWeek,
        entriesThisMonth,
        entryTypes,
        averageWords,
        mostActiveDayData,
      ] = await Promise.all([
        Entry.countDocuments({ userId }),
        Entry.countDocuments({ userId, createdAt: { $gte: startOfDay } }),
        Entry.countDocuments({ userId, createdAt: { $gte: startOfWeek } }),
        Entry.countDocuments({ userId, createdAt: { $gte: startOfMonth } }),
        Entry.aggregate([
          { $match: { userId: new Types.ObjectId(userId) } },
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ]),
        Entry.aggregate([
          { $match: { userId: new Types.ObjectId(userId) } },
          { $project: { wordCount: { $size: { $split: ['$content', ' '] } } } },
          { $group: { _id: null, avgWords: { $avg: '$wordCount' } } },
        ]),
        Entry.aggregate([
          { $match: { userId: new Types.ObjectId(userId) } },
          { $group: { _id: { $dayOfWeek: '$createdAt' }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 1 },
        ]),
      ]);

      const typeStats = {
        text: 0,
        media: 0,
        mixed: 0,
      };

      entryTypes.forEach((type: any) => {
        typeStats[type._id as keyof typeof typeStats] = type.count;
      });

      // Calculate most active day
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const mostActiveDay = mostActiveDayData[0]
        ? dayNames[mostActiveDayData[0]._id - 1] || 'Unknown'
        : 'Unknown';

      const stats: EntryStats = {
        totalEntries,
        entriesThisMonth,
        entriesThisWeek,
        entriesToday,
        averageWordsPerEntry: Math.round(averageWords[0]?.avgWords || 0),
        mostActiveDay,
        entryTypes: typeStats,
      };

      return stats;
    } catch (error) {
      logger.error('Get entry stats failed:', error);
      throw error;
    }
  }
}

export const entryService = new EntryService();

export default EntryService;
