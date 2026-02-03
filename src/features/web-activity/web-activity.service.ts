import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import DateManager from '../../core/utils/DateManager';
import { ActivityDefinitions } from './activity-definitions.model';
import { WebActivitySyncLog } from './web-activity-sync-log.model';
import { ActivitySyncBatch, IWebActivity } from './web-activity.interfaces';
import { WebActivity } from './web-activity.model';

export class WebActivityService {
    private static readonly DOT_REPLACEMENT = '__dot__';

    /**
     * Sync activity for a specific day using atomic increments
     * Includes idempotency check using syncId
     */
    async syncActivity(userId: string, batch: ActivitySyncBatch): Promise<IWebActivity | null> {
        const { syncId, date, totalSeconds, productiveSeconds, distractingSeconds, domainMap } = batch;
        const userObjId = new Types.ObjectId(userId);

        try {
            // 1. Idempotency Check: Have we processed this syncId already?
            const existingLog = await WebActivitySyncLog.findOne({ userId: userObjId, syncId });
            if (existingLog) {
                logger.info('Duplicate sync attempt detected, skipping processing', { userId, syncId });
                return this.getStatsByDate(userId, date);
            }

            // 2. Build increment object for domainMap
            const domainInc: Record<string, number> = {};
            for (const [domain, seconds] of Object.entries(domainMap)) {
                // MongoDB Map increments use 'domainMap.domain_name'
                const safeKey = domain.replace(/\./g, WebActivityService.DOT_REPLACEMENT);
                domainInc[`domainMap.${safeKey}`] = seconds;
            }

            // 3. Update Activity (Atomic Increment)
            const activity = await WebActivity.findOneAndUpdate(
                {
                    userId: userObjId,
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

            // 4. Log successful sync for idempotency
            await WebActivitySyncLog.create({
                userId: userObjId,
                syncId
            });

            logger.info('Web activity synced successfully', {
                userId,
                date,
                syncId,
                totalSeconds: activity?.totalSeconds
            });

            return activity;
        } catch (error) {
            logger.error('Web activity sync failed:', error);
            throw error;
        }
    }

    /**
     * Get stats for a specific day
     */
    async getStatsByDate(userId: string, date?: string, timezone: string = 'UTC'): Promise<IWebActivity | null> {
        try {
            const targetDate = date || DateManager.getLocalDateKey(timezone);
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

    /**
     * Legacy wrapper for getStatsByDate
     */
    async getTodayStats(userId: string, date?: string): Promise<IWebActivity | null> {
        return this.getStatsByDate(userId, date);
    }

    /**
     * Get user-specific activity definitions (productive/distracting domains)
     */
    async getDefinitions(userId: string) {
        const definitions = await ActivityDefinitions.findOne({ userId: new Types.ObjectId(userId) });
        return {
            productiveDomains: definitions?.productiveDomains || [],
            distractingDomains: definitions?.distractingDomains || []
        };
    }

    /**
     * Update user-specific activity definitions
     */
    async updateDefinitions(userId: string, data: { productiveDomains?: string[], distractingDomains?: string[] }) {
        const definitions = await ActivityDefinitions.findOneAndUpdate(
            { userId: new Types.ObjectId(userId) },
            {
                $set: {
                    ...(data.productiveDomains && { productiveDomains: data.productiveDomains }),
                    ...(data.distractingDomains && { distractingDomains: data.distractingDomains })
                }
            },
            { upsert: true, new: true }
        );
        return definitions;
    }

    // Delete all user data (Cascade Delete)
    async deleteUserData(userId: string): Promise<number> {
        const result = await WebActivity.deleteMany({ userId: new Types.ObjectId(userId) });
        return result.deletedCount || 0;
    }
}

export const webActivityService = new WebActivityService();
export default webActivityService;
