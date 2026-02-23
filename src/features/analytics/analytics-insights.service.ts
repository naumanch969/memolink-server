import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { StreakUtil } from '../../shared/utils/streak.utils';
import { Entry } from '../entry/entry.model';

import { IAnalyticsInsightsService } from './analytics.interfaces';

export class AnalyticsInsightsService implements IAnalyticsInsightsService {
    /**
     * Calculates journaling streaks using StreakUtil with a 1-day grace period (2 days total delta).
     */
    async getStreak(userId: string): Promise<any> {
        try {
            const userObjectId = new Types.ObjectId(userId);
            const entries = await Entry.find({ userId: userObjectId }, { date: 1, createdAt: 1 })
                .sort({ date: -1 })
                .lean();

            if (!entries.length) {
                return { currentStreak: 0, longestStreak: 0, lastEntryDate: null, milestones: [7, 30, 100, 365] };
            }

            const dates = entries.map(e => e.date || e.createdAt);
            // For journaling, we use a 2-day grace period (miss 1 day and keep streak) as per original logic
            const result = StreakUtil.calculate(dates, 2);

            return {
                currentStreak: result.currentStreak,
                longestStreak: result.longestStreak,
                lastEntryDate: result.lastDate,
                milestones: [7, 30, 100, 365],
            };
        } catch (error) {
            logger.error('[AnalyticsInsightsService] Get streak failed:', error);
            return { currentStreak: 0, longestStreak: 0, lastEntryDate: null, milestones: [] };
        }
    }

    /**
     * Identifies user writing patterns (e.g., weekend writer)
     */
    async getPatterns(userId: string): Promise<any[]> {
        try {
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
        } catch (error) {
            logger.error('[AnalyticsInsightsService] Get patterns failed:', error);
            return [];
        }
    }

    /**
     * Generates a summary for the last 7 days.
     */
    async getWeeklySummary(userId: string): Promise<any> {
        try {
            const userObjectId = new Types.ObjectId(userId);
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 7);

            const [entries, topEntities, topTags, streakData] = await Promise.all([
                Entry.find({ userId: userObjectId, date: { $gte: start, $lte: end } }).lean(),
                Entry.aggregate([
                    { $match: { userId: userObjectId, date: { $gte: start, $lte: end } } },
                    { $unwind: "$mentions" },
                    { $group: { _id: "$mentions", count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                    { $limit: 3 },
                    { $lookup: { from: "knowledge_entities", localField: "_id", foreignField: "_id", as: "person" } },
                    { $unwind: "$person" },
                    { $project: { entityId: "$_id", name: "$person.name", count: 1 } }
                ]),
                Entry.aggregate([
                    { $match: { userId: userObjectId, date: { $gte: start, $lte: end } } },
                    { $unwind: "$tags" },
                    { $group: { _id: "$tags", count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                    { $limit: 3 },
                    { $lookup: { from: "tags", localField: "_id", foreignField: "_id", as: "tag" } },
                    { $unwind: "$tag" },
                    { $project: { tagId: "$_id", name: "$tag.name", count: 1 } }
                ]),
                this.getStreak(userId)
            ]);

            const totalEntries = entries.length;
            const wordCount = entries.reduce((acc, curr: any) => acc + (curr.content ? curr.content.split(/\s+/).length : 0), 0);

            const moodCounts: Record<string, number> = {};
            entries.forEach((e: any) => {
                if (e.mood) moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
            });

            const moodTrend = Object.entries(moodCounts)
                .map(([mood, count]) => ({ mood, count }))
                .sort((a, b) => b.count - a.count);

            return {
                totalEntries,
                wordCount,
                mostMentionedEntity: topEntities,
                mostUsedTags: topTags,
                moodTrend,
                streak: streakData.currentStreak
            };
        } catch (error) {
            logger.error('[AnalyticsInsightsService] Get weekly summary failed:', error);
            throw error;
        }
    }
}

export const analyticsInsightsService = new AnalyticsInsightsService();
