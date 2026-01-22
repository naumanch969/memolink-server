import { logger } from '../../config/logger';
import { User } from '../auth/auth.model';
import { Entry } from '../entry/entry.model';
import { Goal } from '../goal/goal.model';
import { Media } from '../media/media.model';
import { RoutineTemplate as Routine } from '../routine/routine.model';

export interface UserGrowthData {
    date: string;
    count: number;
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
