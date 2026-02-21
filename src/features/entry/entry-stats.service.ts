import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { EntryStats } from './entry.interfaces';
import { Entry } from './entry.model';

export class EntryStatsService {
    /**
     * Generates a comprehensive statistical overview of user entries
     */
    async getStats(userId: string): Promise<EntryStats> {
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

            // Flatten Type Stats
            const typeStats = { text: 0, media: 0, mixed: 0 };
            entryTypes.forEach((type: any) => {
                if (type._id in typeStats) {
                    typeStats[type._id as keyof typeof typeStats] = type.count;
                }
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
}

export const entryStatsService = new EntryStatsService();
