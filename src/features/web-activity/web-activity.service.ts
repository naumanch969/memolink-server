import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import DateManager from '../../core/utils/date-manager.util';
import { ActivityDefinitions } from './activity-definitions.model';
import { WebActivitySyncLog } from './web-activity-sync-log.model';
import { ActivitySyncBatch, IWebActivity, IWebActivityService } from './web-activity.interfaces';
import { WebActivity } from './web-activity.model';

export class WebActivityService implements IWebActivityService {
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
     * Get user-specific activity definitions (productive/distracting domains + limits)
     */
    async getDefinitions(userId: string) {
        const definitions = await ActivityDefinitions.findOne({ userId: new Types.ObjectId(userId) });
        return {
            productiveDomains: definitions?.productiveDomains || [],
            distractingDomains: definitions?.distractingDomains || [],
            domainLimits: definitions?.domainLimits || []
        };
    }

    /**
     * Add or update a domain limit
     */
    async upsertDomainLimit(userId: string, data: { domain: string; dailyLimitMinutes: number; action: 'nudge' | 'block'; enabled?: boolean }) {
        const userObjId = new Types.ObjectId(userId);
        const { domain, dailyLimitMinutes, action, enabled = true } = data;

        // Check if limit for this domain already exists
        const existing = await ActivityDefinitions.findOne({
            userId: userObjId,
            'domainLimits.domain': domain
        });

        if (existing) {
            // Update existing limit
            await ActivityDefinitions.updateOne(
                { userId: userObjId, 'domainLimits.domain': domain },
                {
                    $set: {
                        'domainLimits.$.dailyLimitMinutes': dailyLimitMinutes,
                        'domainLimits.$.action': action,
                        'domainLimits.$.enabled': enabled
                    }
                }
            );
        } else {
            // Add new limit
            await ActivityDefinitions.findOneAndUpdate(
                { userId: userObjId },
                { $push: { domainLimits: { domain, dailyLimitMinutes, action, enabled } } },
                { upsert: true, new: true }
            );
        }

        return this.getDefinitions(userId);
    }

    /**
     * Remove a domain limit
     */
    async removeDomainLimit(userId: string, domain: string) {
        await ActivityDefinitions.updateOne(
            { userId: new Types.ObjectId(userId) },
            { $pull: { domainLimits: { domain } } }
        );
        return this.getDefinitions(userId);
    }

    /**
     * Check limits against current usage for a specific date.
     * Returns which domains have exceeded or are approaching their limits.
     */
    async checkLimits(userId: string, date?: string): Promise<{
        limits: Array<{
            domain: string;
            dailyLimitMinutes: number;
            usedMinutes: number;
            action: 'nudge' | 'block';
            exceeded: boolean;
            percentUsed: number;
        }>;
    }> {
        const d = date || (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; })();
        const definitions = await this.getDefinitions(userId);
        const activity = await this.getStatsByDate(userId, d);

        if (!definitions.domainLimits || definitions.domainLimits.length === 0) {
            return { limits: [] };
        }

        const domainMap = activity?.domainMap || {};

        const limits = definitions.domainLimits
            .filter(l => l.enabled)
            .map(limit => {
                // Look up usage - domain key uses _ instead of . in domainMap
                const domainKey = limit.domain.replace(/\./g, '_');
                const usedSeconds = (domainMap instanceof Map ? domainMap.get(domainKey) : (domainMap as Record<string, number>)[domainKey]) || 0;
                const usedMinutes = Math.round(usedSeconds / 60);
                const percentUsed = limit.dailyLimitMinutes > 0 ? Math.round((usedMinutes / limit.dailyLimitMinutes) * 100) : 0;

                return {
                    domain: limit.domain,
                    dailyLimitMinutes: limit.dailyLimitMinutes,
                    usedMinutes,
                    action: limit.action,
                    exceeded: usedMinutes >= limit.dailyLimitMinutes,
                    percentUsed: Math.min(percentUsed, 100)
                };
            });

        return { limits };
    }

    /**
     * Get activity for a date range
     */
    async getActivityRange(userId: string, fromDate: string, toDate: string): Promise<IWebActivity[]> {
        try {
            const activities = await WebActivity.find({
                userId: new Types.ObjectId(userId),
                date: {
                    $gte: fromDate,
                    $lte: toDate
                }
            }).sort({ date: 1 });

            return activities;
        } catch (error) {
            logger.error('Get activity range failed:', error);
            throw error;
        }
    }

    /**
     * Get weekly summary (7 days ending on provided date)
     */
    async getWeeklySummary(userId: string, endDate: string): Promise<{
        activities: IWebActivity[];
        totalTime: number;
        avgProductivePercent: number;
        topDomains: Array<{ domain: string; seconds: number }>;
    }> {
        try {
            // Calculate start date (7 days before end date)
            const end = new Date(endDate);
            const start = new Date(end);
            start.setDate(start.getDate() - 6);

            const startStr = start.toISOString().split('T')[0];
            const endStr = endDate;

            const activities = await this.getActivityRange(userId, startStr, endStr);

            // Aggregate stats
            let totalTime = 0;
            let totalProductive = 0;
            const domainAggregates: Record<string, number> = {};

            activities.forEach(activity => {
                totalTime += activity.totalSeconds;
                totalProductive += activity.productiveSeconds;

                // Merge domain maps
                if (activity.domainMap) {
                    // Mongoose map needs to be converted or iterated carefully
                    // If it's a Map
                    const entries = activity.domainMap instanceof Map ? activity.domainMap.entries() : Object.entries(activity.domainMap);
                    for (const [domain, seconds] of entries) {
                        const safeDomain = domain.replace(/__dot__/g, '.');
                        domainAggregates[safeDomain] = (domainAggregates[safeDomain] || 0) + (seconds as number);
                    }
                }
            });

            // Calculate average productive percentage
            const avgProductivePercent = totalTime > 0
                ? Math.round((totalProductive / totalTime) * 100)
                : 0;

            // Get top 10 domains
            const topDomains = Object.entries(domainAggregates)
                .map(([domain, seconds]) => ({ domain, seconds }))
                .sort((a, b) => b.seconds - a.seconds)
                .slice(0, 10);

            return {
                activities,
                totalTime,
                avgProductivePercent,
                topDomains
            };
        } catch (error) {
            logger.error('Get weekly summary failed:', error);
            throw error;
        }
    }

    /**
     * Get monthly summary
     */
    async getMonthlySummary(userId: string, year: number, month: number): Promise<{
        activities: IWebActivity[];
        totalTime: number;
        avgProductivePercent: number;
        mostProductiveDay: string | null;
        leastProductiveDay: string | null;
        topDomains: Array<{ domain: string; seconds: number }>;
    }> {
        try {
            // Get first and last day of month
            // Note: Month is 1-indexed in argument but Date ctor expects 0-indexed month
            const firstDay = new Date(year, month - 1, 1);
            // Day 0 of next month gives last day of current month
            const lastDay = new Date(year, month, 0);

            // Format YYYY-MM-DD manually to avoid timezone shifts if using toISOString() on local dates without care
            const formatDate = (d: Date) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            };

            const fromDate = formatDate(firstDay);
            const toDate = formatDate(lastDay);

            const activities = await this.getActivityRange(userId, fromDate, toDate);

            // Aggregate stats
            let totalTime = 0;
            let totalProductive = 0;
            const domainAggregates: Record<string, number> = {};
            let mostProductiveDay: { date: string; seconds: number } | null = null;
            let leastProductiveDay: { date: string; seconds: number } | null = null;

            activities.forEach(activity => {
                totalTime += activity.totalSeconds;
                totalProductive += activity.productiveSeconds;

                // Track most/least productive days
                if (!mostProductiveDay || activity.productiveSeconds > mostProductiveDay.seconds) {
                    mostProductiveDay = { date: activity.date, seconds: activity.productiveSeconds };
                }
                if (!leastProductiveDay || (activity.productiveSeconds < leastProductiveDay.seconds && activity.totalSeconds > 0)) {
                    leastProductiveDay = { date: activity.date, seconds: activity.productiveSeconds };
                }

                // Merge domain maps
                if (activity.domainMap) {
                    const entries = activity.domainMap instanceof Map ? activity.domainMap.entries() : Object.entries(activity.domainMap);
                    for (const [domain, seconds] of entries) {
                        const safeDomain = domain.replace(/__dot__/g, '.');
                        domainAggregates[safeDomain] = (domainAggregates[safeDomain] || 0) + (seconds as number);
                    }
                }
            });

            const avgProductivePercent = totalTime > 0
                ? Math.round((totalProductive / totalTime) * 100)
                : 0;

            const topDomains = Object.entries(domainAggregates)
                .map(([domain, seconds]) => ({ domain, seconds }))
                .sort((a, b) => b.seconds - a.seconds)
                .slice(0, 10);

            return {
                activities,
                totalTime,
                avgProductivePercent,
                mostProductiveDay: mostProductiveDay?.date || null,
                leastProductiveDay: leastProductiveDay?.date || null,
                topDomains
            };
        } catch (error) {
            logger.error('Get monthly summary failed:', error);
            throw error;
        }
    }

    /**
     * Update user-specific activity definitions
     */
    async updateDefinitions(userId: string, data: { productiveDomains?: string[], distractingDomains?: string[], domainLimits?: Array<{ domain: string; dailyLimitMinutes: number; action: 'nudge' | 'block'; enabled?: boolean }> }) {
        const setFields: Record<string, unknown> = {};
        if (data.productiveDomains) setFields.productiveDomains = data.productiveDomains;
        if (data.distractingDomains) setFields.distractingDomains = data.distractingDomains;
        if (data.domainLimits) setFields.domainLimits = data.domainLimits;

        const definitions = await ActivityDefinitions.findOneAndUpdate(
            { userId: new Types.ObjectId(userId) },
            { $set: setFields },
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
