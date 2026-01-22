import { logger } from '../../config/logger';
import { User } from '../auth/auth.model';
import { Entry } from '../entry/entry.model';
import { Goal } from '../goal/goal.model';
import { Media } from '../media/media.model';
import { Person } from '../person/person.model';
import { RoutineTemplate as Routine } from '../routine/routine.model';
import { Tag } from '../tag/tag.model';

export interface UserGrowthData {
    date: string;
    count: number;
}

export interface ContentGrowthData {
    date: string;
    entries: number;
    media: number;
}

export interface PlatformStats {
    platform: string;
    count: number;
    percentage: number;
}

export interface FeatureStats {
    users: number;
    entries: number;
    media: number;
    routines: number;
    goals: number;
}

export interface UserAccountStats {
    roles: { role: string; count: number }[];
    verification: { status: string; count: number }[];
}

export interface ActiveUserStats {
    daily: number;
    weekly: number;
    monthly: number;
}

export interface FeatureUsageBreakdown {
    entryTypes: { type: string; count: number }[];
    mediaTypes: { type: string; count: number }[];
    mediaStorage: { type: string; size: number }[];
    topTags: { name: string; count: number }[];
    topPeople: { name: string; count: number }[];
}

export interface RetentionStats {
    cohort: string;
    retention: number;
}

export class AdminAnalyticsService {

    /**
     * Get user signups grouped by date (last 30 days)
     */
    async getUserGrowth(): Promise<UserGrowthData[]> {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const growth = await User.aggregate([
                { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            return growth.map(g => ({
                date: g._id,
                count: g.count
            }));
        } catch (error) {
            logger.error('Failed to get user growth:', error);
            return [];
        }
    }

    /**
     * Get entry and media creation growth (last 30 days)
     */
    async getContentGrowth(): Promise<ContentGrowthData[]> {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const [entryGrowth, mediaGrowth] = await Promise.all([
                Entry.aggregate([
                    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }
                ]),
                Media.aggregate([
                    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }
                ])
            ]);

            const combinedMap: Record<string, ContentGrowthData> = {};

            // Initialize with last 30 days
            for (let i = 0; i < 30; i++) {
                const date = new Date(thirtyDaysAgo);
                date.setDate(date.getDate() + i + 1);
                const dateStr = date.toISOString().split('T')[0];
                combinedMap[dateStr] = { date: dateStr, entries: 0, media: 0 };
            }

            entryGrowth.forEach(g => { if (combinedMap[g._id]) combinedMap[g._id].entries = g.count; });
            mediaGrowth.forEach(g => { if (combinedMap[g._id]) combinedMap[g._id].media = g.count; });

            return Object.values(combinedMap).sort((a, b) => a.date.localeCompare(b.date));
        } catch (error) {
            logger.error('Failed to get content growth:', error);
            return [];
        }
    }

    /**
     * Get total counts for key features
     */
    async getFeatureStats(): Promise<FeatureStats> {
        try {
            const [users, entries, media, routines, goals] = await Promise.all([
                User.countDocuments(),
                Entry.countDocuments(),
                Media.countDocuments(),
                Routine ? Routine.countDocuments() : 0,
                Goal ? Goal.countDocuments() : 0
            ]);

            return { users, entries, media, routines, goals };
        } catch (error) {
            logger.error('Failed to get feature stats:', error);
            return { users: 0, entries: 0, media: 0, routines: 0, goals: 0 };
        }
    }

    /**
     * Get detailed breakdown of feature usage
     */
    async getFeatureUsageBreakdown(): Promise<FeatureUsageBreakdown> {
        try {
            const [entryTypes, mediaTypes, mediaStorage, topTags, topPeople] = await Promise.all([
                Entry.aggregate([
                    { $group: { _id: '$type', count: { $sum: 1 } } },
                    { $project: { type: '$_id', count: 1, _id: 0 } }
                ]),
                Media.aggregate([
                    { $group: { _id: '$type', count: { $sum: 1 } } },
                    { $project: { type: '$_id', count: 1, _id: 0 } }
                ]),
                Media.aggregate([
                    { $group: { _id: '$type', size: { $sum: '$size' } } },
                    { $project: { type: '$_id', size: 1, _id: 0 } }
                ]),
                Tag.find().sort({ usageCount: -1 }).limit(10).select('name usageCount -_id'),
                Person.find().sort({ interactionCount: -1 }).limit(10).select('name interactionCount -_id')
            ]);

            return {
                entryTypes,
                mediaTypes,
                mediaStorage,
                topTags: topTags.map(t => ({ name: t.name, count: t.usageCount })),
                topPeople: topPeople.map(p => ({ name: p.name, count: p.interactionCount }))
            };
        } catch (error) {
            logger.error('Failed to get feature usage breakdown:', error);
            return { entryTypes: [], mediaTypes: [], mediaStorage: [], topTags: [], topPeople: [] };
        }
    }

    /**
     * Get retention statistics
     */
    async getRetentionStats(): Promise<RetentionStats[]> {
        try {
            // Simple retention cohorts by signup week
            const now = new Date();
            const cohorts = [];

            for (let i = 1; i <= 4; i++) {
                const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
                const nextWeekStart = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

                const signups = await User.countDocuments({
                    createdAt: { $gte: weekStart, $lt: nextWeekStart }
                });

                if (signups > 0) {
                    const retained = await User.countDocuments({
                        createdAt: { $gte: weekStart, $lt: nextWeekStart },
                        lastLoginAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
                    });

                    cohorts.push({
                        cohort: `Week of ${weekStart.toISOString().split('T')[0]}`,
                        retention: Math.round((retained / signups) * 100)
                    });
                }
            }

            return cohorts;
        } catch (error) {
            logger.error('Failed to get retention stats:', error);
            return [];
        }
    }

    /**
     * Get user account distribution (roles and verification)
     */
    async getUserAccountStats(): Promise<UserAccountStats> {
        try {
            const [roles, verification] = await Promise.all([
                User.aggregate([
                    { $group: { _id: '$role', count: { $sum: 1 } } },
                    { $project: { role: '$_id', count: 1, _id: 0 } }
                ]),
                User.aggregate([
                    { $group: { _id: '$isEmailVerified', count: { $sum: 1 } } },
                    { $project: { status: { $cond: { if: '$_id', then: 'Verified', else: 'Unverified' } }, count: 1, _id: 0 } }
                ])
            ]);

            return { roles, verification };
        } catch (error) {
            logger.error('Failed to get user account stats:', error);
            return { roles: [], verification: [] };
        }
    }

    /**
     * Get active user counts for different periods
     */
    async getActiveUserStats(): Promise<ActiveUserStats> {
        try {
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            const [daily, weekly, monthly] = await Promise.all([
                User.countDocuments({ lastLoginAt: { $gte: oneDayAgo } }),
                User.countDocuments({ lastLoginAt: { $gte: sevenDaysAgo } }),
                User.countDocuments({ lastLoginAt: { $gte: thirtyDaysAgo } })
            ]);

            return { daily, weekly, monthly };
        } catch (error) {
            logger.error('Failed to get active user stats:', error);
            return { daily: 0, weekly: 0, monthly: 0 };
        }
    }

    /**
     * Get Platform Distribution (Mock for now as data is missing)
     */
    async getPlatformStats(): Promise<PlatformStats[]> {
        return [
            { platform: 'Web', count: 650, percentage: 52.7 },
            { platform: 'Extension', count: 420, percentage: 34.0 },
            { platform: 'Mobile', count: 164, percentage: 13.3 },
        ];
    }

    /**
     * High-level Dashboard Overview Stats
     */
    async getDashboardStats() {
        const features = await this.getFeatureStats();
        const activeStats = await this.getActiveUserStats();

        return {
            totalUsers: features.users,
            activeUsers: activeStats.monthly,
            totalEntries: features.entries,
            storageUsedBytes: 0,
        };
    }
}

export const adminAnalyticsService = new AdminAnalyticsService();
