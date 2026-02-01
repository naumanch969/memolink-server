import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { ActivitySyncBatch, IWebActivity } from './web-activity.interfaces';
import { WebActivity } from './web-activity.model';

export class WebActivityService {
    /**
     * Syncs activity batch from client to server.
     * Uses atomic increments to ensure performance and data integrity.
     */
    async syncActivity(userId: string, batch: ActivitySyncBatch): Promise<IWebActivity> {
        try {
            const { date, totalSeconds, productiveSeconds, distractingSeconds, domainMap } = batch;

            // Prepare updates for main counters
            const incUpdate: any = {
                totalSeconds,
                productiveSeconds,
                distractingSeconds,
            };

            // Prepare updates for domain specific counters
            Object.entries(domainMap).forEach(([domain, seconds]) => {
                // Sanitize domain name for MongoDB keys (replace . with _ if needed, but modern Mongo handles dots)
                // However, it's safer to avoid dots in keys inside the Map if possible, but Map allows it.
                // If we use Map type in Mongoose, it handles dots fine.
                incUpdate[`domainMap.${domain.replace(/\./g, '___')}`] = seconds;
            });

            // We use findOneAndUpdate with upsert: true and setOnInsert for initialization
            // Note: domainMap keys with dots can be tricky. Mongoose Map handles them by default.
            // But we will use a more robust way to increment map values.

            const updateObject: any = {
                $inc: {
                    totalSeconds,
                    productiveSeconds,
                    distractingSeconds,
                }
            };

            // Handle domainMap increments
            Object.entries(domainMap).forEach(([domain, seconds]) => {
                // We use the dot notation for incrementing map values. 
                // We replace dots in domain to avoid sub-document nesting issues if any, 
                // though Map should handle it. Let's use a delimiter.
                const safeKey = domain.replace(/\./g, '_dot_');
                updateObject.$inc[`domainMap.${safeKey}`] = seconds;
            });

            const activity = await WebActivity.findOneAndUpdate(
                { userId: new Types.ObjectId(userId), date },
                updateObject,
                {
                    new: true,
                    upsert: true,
                    setDefaultsOnInsert: true
                }
            );

            logger.info('Activity synced successfully', { userId, date, totalSeconds });
            return activity;
        } catch (error) {
            logger.error('Activity sync failed', { error: error instanceof Error ? error.message : error, userId });
            throw error;
        }
    }

    /**
     * Get stats for a date range
     */
    async getStats(userId: string, dateFrom: string, dateTo: string): Promise<IWebActivity[]> {
        return WebActivity.find({
            userId: new Types.ObjectId(userId),
            date: { $gte: dateFrom, $lte: dateTo }
        }).sort({ date: 1 });
    }

    /**
     * Get stats for a specific day (defaults to today)
     */
    async getTodayStats(userId: string, date?: string): Promise<IWebActivity | null> {
        const targetDate = date || new Date().toISOString().split('T')[0];
        return WebActivity.findOne({
            userId: new Types.ObjectId(userId),
            date: targetDate
        });
    }
}

export const webActivityService = new WebActivityService();
