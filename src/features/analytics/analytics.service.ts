import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { createError } from '../../core/middleware/errorHandler';
import { Entry } from '../entry/entry.model';
import { Media } from '../media/media.model';
import { Person } from '../person/person.model';
import { Tag } from '../tag/tag.model';
import { AnalyticsRequest } from './analytics.interfaces';

import { AnalyticsData } from '../../shared/types';

export class AnalyticsService {
  static async getAnalytics(userId: string, options: AnalyticsRequest = {}): Promise<AnalyticsData> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Get basic counts
      const [
        totalEntries,
        entriesThisMonth,
        totalPeople,
        totalTags,
        totalMedia,
      ] = await Promise.all([
        Entry.countDocuments({ userId: userObjectId }),
        Entry.countDocuments({ userId: userObjectId, createdAt: { $gte: startOfMonth } }),
        Person.countDocuments({ userId: userObjectId }),
        Tag.countDocuments({ userId: userObjectId }),
        Media.countDocuments({ userId: userObjectId }),
      ]);

      // Get entry frequency data
      const entryFrequency = await this.getEntryFrequency(userId);

      // Get top people and tags
      const [topPeople, topTags] = await Promise.all([
        this.getTopPeople(userId),
        this.getTopTags(userId),
      ]);

      // Get media stats
      const mediaStats = await this.getMediaStats(userId);

      const analytics: AnalyticsData = {
        totalEntries,
        entriesThisMonth,
        totalPeople,
        totalTags,
        totalMedia,
        entryFrequency,
        topPeople,
        topTags,
        mediaStats,
      };

      logger.info('Analytics retrieved successfully', { userId });
      return analytics;
    } catch (error) {
      logger.error('Get analytics failed:', error);
      throw error;
    }
  }

  static async getEntryAnalytics(userId: string, options: AnalyticsRequest = {}): Promise<any> {
    try {
      // TODO: Implement entry analytics
      throw createError('Entry analytics not implemented yet', 501);
    } catch (error) {
      logger.error('Get entry analytics failed:', error);
      throw error;
    }
  }

  private static async getEntryFrequency(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();

    // Get last 30 days of entries
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dailyEntries = await Entry.aggregate([
      { $match: { userId: userObjectId, createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get weekly entries (last 12 weeks)
    const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);

    const weeklyEntries = await Entry.aggregate([
      { $match: { userId: userObjectId, createdAt: { $gte: twelveWeeksAgo } } },
      {
        $group: {
          _id: { $week: '$createdAt' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get monthly entries (last 12 months)
    const twelveMonthsAgo = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000);

    const monthlyEntries = await Entry.aggregate([
      { $match: { userId: userObjectId, createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: { $month: '$createdAt' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      daily: dailyEntries.map(entry => entry.count),
      weekly: weeklyEntries.map(entry => entry.count),
      monthly: monthlyEntries.map(entry => entry.count),
    };
  }

  private static async getTopPeople(userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    const topPeople = await Person.aggregate([
      { $match: { userId: userObjectId } },
      { $sort: { interactionCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'entries',
          localField: '_id',
          foreignField: 'mentions',
          as: 'entries',
        },
      },
      {
        $project: {
          person: {
            _id: '$_id',
            name: '$name',
            avatar: '$avatar',
            interactionCount: '$interactionCount',
          },
          interactionCount: '$interactionCount',
        },
      },
    ]);

    return topPeople;
  }

  private static async getTopTags(userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    const topTags = await Tag.aggregate([
      { $match: { userId: userObjectId } },
      { $sort: { usageCount: -1 } },
      { $limit: 10 },
      {
        $project: {
          tag: {
            _id: '$_id',
            name: '$name',
            color: '$color',
            usageCount: '$usageCount',
          },
          usageCount: '$usageCount',
        },
      },
    ]);

    return topTags;
  }

  private static async getMediaStats(userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    const mediaStats = await Media.aggregate([
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = {
      totalImages: 0,
      totalVideos: 0,
      totalDocuments: 0,
    };

    mediaStats.forEach(stat => {
      switch (stat._id) {
        case 'image':
          stats.totalImages = stat.count;
          break;
        case 'video':
          stats.totalVideos = stat.count;
          break;
        case 'document':
          stats.totalDocuments = stat.count;
          break;
      }
    });

    return stats;
  }



  static async getMediaAnalytics(userId: string, options: AnalyticsRequest = {}): Promise<any> {
    try {
      // TODO: Implement media analytics
      throw createError('Media analytics not implemented yet', 501);
    } catch (error) {
      logger.error('Get media analytics failed:', error);
      throw error;
    }
  }
  static async getGraphData(userId: string): Promise<any> {
    try {
      const userObjectId = new Types.ObjectId(userId);

      // 1. Fetch people and tags to create base nodes
      const [people, tags, entries] = await Promise.all([
        Person.find({ userId: userObjectId }).select('_id name avatar').lean(),
        Tag.find({ userId: userObjectId }).select('_id name color').lean(),
        Entry.find({ userId: userObjectId })
          .select('_id mentions tags')
          .populate('mentions', '_id name')
          .populate('tags', '_id name')
          .lean()
      ]);

      const nodes: any[] = [];
      const links: any[] = [];
      const nodeIds = new Set<string>();

      // Add People Nodes
      people.forEach(p => {
        nodes.push({ id: p._id.toString(), label: p.name, group: 'person', img: p.avatar, val: 1 });
        nodeIds.add(p._id.toString());
      });

      // Add Tag Nodes
      tags.forEach(t => {
        nodes.push({ id: t._id.toString(), label: t.name, group: 'tag', color: t.color, val: 1 });
        nodeIds.add(t._id.toString());
      });

      // Calculate Edges based on Co-occurrence in Entries
      const linkMap = new Map<string, number>();

      entries.forEach(entry => {
        // Collect all entity IDs in this entry
        const entities = [
          ...(entry.mentions || []).map((m: any) => m._id.toString()),
          ...(entry.tags || []).map((t: any) => t._id.toString())
        ];

        // Create links between all unique pairs in this entry
        for (let i = 0; i < entities.length; i++) {
          for (let j = i + 1; j < entities.length; j++) {
            const source = entities[i];
            const target = entities[j];

            // Ensure source/target exist in our nodes (sanity check)
            if (nodeIds.has(source) && nodeIds.has(target)) {
              // Sort to ensure consistent key for A-B vs B-A
              const linkKey = [source, target].sort().join('-');
              linkMap.set(linkKey, (linkMap.get(linkKey) || 0) + 1);
            }
          }
        }
      });

      // Convert LinkMap to array
      linkMap.forEach((weight, key) => {
        const [source, target] = key.split('-');
        links.push({ source, target, value: weight });
      });

      // Update node values (size) based on degree
      links.forEach(link => {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        if (sourceNode) sourceNode.val += link.value * 0.5;
        if (targetNode) targetNode.val += link.value * 0.5;
      });

      return { nodes, links };

    } catch (error) {
      logger.error('Get graph data failed:', error);
      throw error;
    }
  }
}

export const analyticsService = new AnalyticsService();

export default AnalyticsService;
