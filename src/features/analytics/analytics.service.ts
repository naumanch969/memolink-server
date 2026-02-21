import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { ApiError } from '../../core/errors/api.error';
import { AgentTask } from '../agent/agent.model';
import { KnowledgeEntity } from '../entity/entity.model';
import { Entry } from '../entry/entry.model';
import { Media } from '../media/media.model';
import { Tag } from '../tag/tag.model';
import { analyticsGraphService } from './analytics-graph.service';
import { analyticsInsightsService } from './analytics-insights.service';
import { AnalyticsData, AnalyticsRequest } from './analytics.interfaces';

export class AnalyticsService {
  /**
   * Main dashboard analytics aggregator.
   */
  async getAnalytics(userId: string, options: AnalyticsRequest = {}): Promise<AnalyticsData> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // 1. Basic Counts
      const [
        totalEntries,
        entriesThisMonth,
        totalEntities,
        totalTags,
        totalMedia,
        entryFrequency,
        topEntities,
        topTags,
        mediaStats
      ] = await Promise.all([
        Entry.countDocuments({ userId: userObjectId }),
        Entry.countDocuments({ userId: userObjectId, createdAt: { $gte: startOfMonth } }),
        KnowledgeEntity.countDocuments({ userId: userObjectId, isDeleted: false }),
        Tag.countDocuments({ userId: userObjectId }),
        Media.countDocuments({ userId: userObjectId }),
        this.getEntryFrequency(userId),
        this.getTopEntities(userId),
        this.getTopTags(userId),
        this.getMediaStats(userId)
      ]);

      // 2. Latest AI Analysis Results
      const [latestReflectionTask, latestWeeklyTask] = await Promise.all([
        AgentTask.findOne({
          userId: userId,
          type: 'DAILY_REFLECTION',
          status: { $in: ['COMPLETED', 'completed'] }
        }).sort({ completedAt: -1 }).lean(),
        AgentTask.findOne({
          userId: userId,
          type: 'WEEKLY_ANALYSIS',
          status: { $in: ['COMPLETED', 'completed'] }
        }).sort({ completedAt: -1 }).lean()
      ]);

      // 3. Proactive Auto-Trigger: Weekly Analysis
      this.checkAndTriggerWeeklyAnalysis(userId, latestWeeklyTask as any);

      return {
        totalEntries,
        entriesThisMonth,
        totalEntities,
        totalTags,
        totalMedia,
        entryFrequency,
        topEntities,
        topTags,
        mediaStats,
        latestReflection: latestReflectionTask?.outputData,
        latestWeeklyAnalysis: latestWeeklyTask?.outputData
      };
    } catch (error) {
      logger.error('Get analytics failed:', error);
      throw error;
    }
  }

  // DELEGATED METHODS
  async getGraphData(userId: string) { return analyticsGraphService.getGraphData(userId); }
  async getStreak(userId: string) { return analyticsInsightsService.getStreak(userId); }
  async getPatterns(userId: string) { return analyticsInsightsService.getPatterns(userId); }
  async getWeeklySummary(userId: string) { return analyticsInsightsService.getWeeklySummary(userId); }

  /**
   * Calculates entry frequency over daily, weekly, and monthly periods.
   */
  async getEntryFrequency(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
    const twelveMonthsAgo = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000);

    const [daily, weekly, monthly] = await Promise.all([
      Entry.aggregate([
        { $match: { userId: userObjectId, createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      Entry.aggregate([
        { $match: { userId: userObjectId, createdAt: { $gte: twelveWeeksAgo } } },
        { $group: { _id: { $week: '$createdAt' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      Entry.aggregate([
        { $match: { userId: userObjectId, createdAt: { $gte: twelveMonthsAgo } } },
        { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ])
    ]);

    return {
      daily: daily.map(d => d.count),
      weekly: weekly.map(w => w.count),
      monthly: monthly.map(m => m.count)
    };
  }

  private async getTopEntities(userId: string) {
    return KnowledgeEntity.aggregate([
      { $match: { userId: new Types.ObjectId(userId), isDeleted: false } },
      { $sort: { interactionCount: -1 } },
      { $limit: 10 },
      { $project: { entity: { _id: '$_id', name: '$name', avatar: '$avatar', interactionCount: '$interactionCount' }, interactionCount: '$interactionCount' } }
    ]);
  }

  private async getTopTags(userId: string) {
    return Tag.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      { $sort: { usageCount: -1 } },
      { $limit: 10 },
      { $project: { tag: { _id: '$_id', name: '$name', color: '$color', usageCount: '$usageCount' }, usageCount: '$usageCount' } }
    ]);
  }

  private async getMediaStats(userId: string) {
    const stats = await Media.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const result = { totalImages: 0, totalVideos: 0, totalDocuments: 0 };
    stats.forEach(s => {
      if (s._id === 'image') result.totalImages = s.count;
      else if (s._id === 'video') result.totalVideos = s.count;
      else if (s._id === 'document') result.totalDocuments = s.count;
    });
    return result;
  }

  private async checkAndTriggerWeeklyAnalysis(userId: string, latestWeeklyTask: any) {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const shouldTrigger = !latestWeeklyTask || (Date.now() - new Date(latestWeeklyTask.completedAt).getTime() > SEVEN_DAYS_MS);

    if (shouldTrigger) {
      const { agentService } = await import('../agent/agent.service');
      agentService.createTask(userId, 'WEEKLY_ANALYSIS' as any, {})
        .catch(err => logger.error('Failed to auto-trigger weekly analysis', err));
    }
  }

  // Placeholder for TODOs
  async getEntryAnalytics(userId: string, options: AnalyticsRequest = {}) { throw ApiError.badRequest('Entry analytics not implemented'); }
  async getMediaAnalytics(userId: string, options: AnalyticsRequest = {}) { throw ApiError.badRequest('Media analytics not implemented'); }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
