import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { createError } from '../../core/middleware/errorHandler';
import { Entry } from '../entry/entry.model';
import { Media } from '../media/media.model';
import { Person } from '../person/person.model';
import { Tag } from '../tag/tag.model';
import { AnalyticsRequest } from './analytics.interfaces';

import { AgentTask } from '../agent/agent.model';
import { AnalyticsData } from './analytics.interfaces';

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

      // Get latest reflection from agent tasks
      const latestReflectionTask = await AgentTask.findOne({
        userId: userId, // Use string ID for AgentTask model
        type: 'DAILY_REFLECTION',
        status: { $in: ['COMPLETED', 'completed'] }
      }).sort({ completedAt: -1 }).lean();

      const latestWeeklyTask = await AgentTask.findOne({
        userId: userId, // Use string ID for AgentTask model
        type: 'WEEKLY_ANALYSIS',
        status: { $in: ['COMPLETED', 'completed'] }
      }).sort({ completedAt: -1 }).lean();

      // Proactive: If no weekly analysis or it's older than 7 days, trigger a new one
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const shouldTriggerWeekly = !latestWeeklyTask ||
        (new Date().getTime() - new Date(latestWeeklyTask.completedAt!).getTime() > SEVEN_DAYS_MS);

      if (shouldTriggerWeekly) {
        // Trigger in background via AgentService to avoid blocking analytics response
        const { agentService } = await import('../agent/agent.service');
        agentService.createTask(userId, 'WEEKLY_ANALYSIS' as any, {})
          .catch(err => logger.error('Failed to auto-trigger weekly analysis', err));
      }

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
        latestReflection: latestReflectionTask?.outputData,
        latestWeeklyAnalysis: latestWeeklyTask?.outputData
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

  // Merged from Insights Service
  static async getStreak(userId: string): Promise<any> {
    const userObjectId = new Types.ObjectId(userId);

    const entries = await Entry.find({ userId: userObjectId }, { date: 1, createdAt: 1 })
      .sort({ date: -1 })
      .lean();

    if (!entries.length) {
      return { currentStreak: 0, longestStreak: 0, lastEntryDate: null, milestones: [] };
    }

    const dates = entries.map(e => {
      const d = new Date(e.date || e.createdAt);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    });

    const uniqueDates = Array.from(new Set(dates)).sort((a, b) => b - a);

    if (uniqueDates.length === 0) return { currentStreak: 0, longestStreak: 0, lastEntryDate: null, milestones: [] };

    let currentStreak = 0;
    let longestStreak = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    const lastEntryTime = uniqueDates[0];

    let tempStreak = 1;
    let maxStr = 1;

    for (let i = 0; i < uniqueDates.length - 1; i++) {
      const curr = uniqueDates[i];
      const next = uniqueDates[i + 1];
      const diffDays = (curr - next) / (1000 * 60 * 60 * 24);

      if (diffDays <= 2) {
        tempStreak++;
      } else {
        if (tempStreak > maxStr) maxStr = tempStreak;
        tempStreak = 1;
      }
    }
    if (tempStreak > maxStr) maxStr = tempStreak;
    longestStreak = maxStr;

    const daysSinceLast = (todayTime - lastEntryTime) / (1000 * 60 * 60 * 24);

    if (daysSinceLast <= 2) {
      let currStr = 1;
      for (let i = 0; i < uniqueDates.length - 1; i++) {
        const curr = uniqueDates[i];
        const next = uniqueDates[i + 1];
        const diffDays = (curr - next) / (1000 * 60 * 60 * 24);

        if (diffDays <= 2) {
          currStr++;
        } else {
          break;
        }
      }
      currentStreak = currStr;
    } else {
      currentStreak = 0;
    }

    return {
      currentStreak,
      longestStreak,
      lastEntryDate: new Date(lastEntryTime),
      milestones: [7, 30, 100, 365],
    };
  }

  static async getPatterns(userId: string): Promise<any[]> {
    const userObjectId = new Types.ObjectId(userId);
    const patterns: any[] = [];

    const dayDistribution = await Entry.aggregate([
      { $match: { userId: userObjectId } },
      {
        $project: {
          dayOfWeek: { $dayOfWeek: "$date" }
        }
      },
      {
        $group: {
          _id: "$dayOfWeek",
          count: { $sum: 1 }
        }
      }
    ]);

    const weekendCount = dayDistribution.filter(d => d._id === 1 || d._id === 7).reduce((a, b) => a + b.count, 0);
    const weekdayCount = dayDistribution.filter(d => d._id > 1 && d._id < 7).reduce((a, b) => a + b.count, 0);

    if (weekendCount / 2 > weekdayCount / 5 * 1.2) {
      patterns.push({
        id: 'weekend-writer',
        type: 'time',
        description: 'You write significantly more on weekends.',
        significance: 'medium',
        data: { weekendCount, weekdayCount }
      });
    }

    return patterns;
  }

  static async getWeeklySummary(userId: string): Promise<any> {
    const userObjectId = new Types.ObjectId(userId);
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);

    const entries = await Entry.find({
      userId: userObjectId,
      date: { $gte: start, $lte: end }
    });

    const totalEntries = entries.length;
    const wordCount = entries.reduce((acc, curr) => {
      return acc + (curr.content ? curr.content.split(/\s+/).length : 0);
    }, 0);

    const topPeople = await Entry.aggregate([
      { $match: { userId: userObjectId, date: { $gte: start, $lte: end } } },
      { $unwind: "$mentions" },
      { $group: { _id: "$mentions", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 },
      { $lookup: { from: "people", localField: "_id", foreignField: "_id", as: "person" } },
      { $unwind: "$person" },
      { $project: { personId: "$_id", name: "$person.name", count: 1 } }
    ]);

    const topTags = await Entry.aggregate([
      { $match: { userId: userObjectId, date: { $gte: start, $lte: end } } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 },
      { $lookup: { from: "tags", localField: "_id", foreignField: "_id", as: "tag" } },
      { $unwind: "$tag" },
      { $project: { tagId: "$_id", name: "$tag.name", count: 1 } }
    ]);

    const moodCounts: Record<string, number> = {};
    entries.forEach(e => {
      if (e.mood) {
        moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
      }
    });
    const moodTrend = Object.entries(moodCounts)
      .map(([mood, count]) => ({ mood, count }))
      .sort((a, b) => b.count - a.count);

    const streakData = await this.getStreak(userId);

    return {
      totalEntries,
      wordCount,
      mostMentionedPeople: topPeople,
      mostUsedTags: topTags,
      moodTrend,
      streak: streakData.currentStreak
    };
  }
}

export const analyticsService = new AnalyticsService();

export default AnalyticsService;
