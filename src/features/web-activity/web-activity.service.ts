import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { ActivitySyncBatch, IWebActivity } from './web-activity.interfaces';
import { WebActivity } from './web-activity.model';

export class WebActivityService {
    /**
     * Sync activity for a specific day using atomic increments
     */
    async syncActivity(userId: string, batch: ActivitySyncBatch): Promise<IWebActivity | null> {
        try {
            const { date, totalSeconds, productiveSeconds, distractingSeconds, domainMap } = batch;

            // Build increment object for domainMap
            const domainInc: Record<string, number> = {};
            for (const [domain, seconds] of Object.entries(domainMap)) {
                // MongoDB Map increments use 'domainMap.domain_name'
                const safeKey = domain.replace(/\./g, '_'); // Avoid issues with dots in keys if not handled by mongoose Maps
                domainInc[`domainMap.${safeKey}`] = seconds;
            }

            const activity = await WebActivity.findOneAndUpdate(
                {
                    userId: new Types.ObjectId(userId),
                    date: date
                },
                {
                    $inc: {
                        totalSeconds,
                        productiveSeconds,
                        distractingSeconds,
                        ...domainInc
                    }
                },
                {
                    upsert: true,
                    new: true,
                    runValidators: true
                }
            );

            logger.info('Web activity synced successfully', {
                userId,
                date,
                totalSeconds: activity?.totalSeconds
            });

            return activity;
        } catch (error) {
            logger.error('Web activity sync failed:', error);
            throw error;
        }
    }

    /**
     * Get stats for a specific day (defaults to today)
     */
    async getTodayStats(userId: string, date?: string): Promise<IWebActivity | null> {
        try {
            const targetDate = date || new Date().toISOString().split('T')[0];
            const activity = await WebActivity.findOne({
                userId: new Types.ObjectId(userId),
                date: targetDate
            });

            return activity;
        } catch (error) {
            logger.error('Get web activity stats failed:', error);
            throw error;
        }
    }
}

export const webActivityService = new WebActivityService();
