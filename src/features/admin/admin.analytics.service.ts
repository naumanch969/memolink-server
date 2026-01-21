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
                Routine ? Routine.countDocuments() : 0, // Handle missing models safely
                Goal ? Goal.countDocuments() : 0
            ]);

            return { users, entries, media, routines, goals };
        } catch (error) {
            logger.error('Failed to get feature stats:', error);
            return { users: 0, entries: 0, media: 0, routines: 0, goals: 0 };
        }
    }

    /**
     * Get Platform Distribution (Mock for now as data is missing)
     */
    async getPlatformStats(): Promise<PlatformStats[]> {
        // TODO: Implement real tracking in User/Auth model
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
        // Get active users (logged in last 30 days) - approx
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const activeUsers = await User.countDocuments({
            createdAt: { $gte: thirtyDaysAgo } // Using createdAt as proxy if lastLoginAt not reliable yet
        });

        return {
            totalUsers: features.users,
            activeUsers,
            totalEntries: features.entries,
            storageUsedBytes: 0, // TODO: Aggregate from User.storageUsed
        };
    }
}

export const adminAnalyticsService = new AdminAnalyticsService();
