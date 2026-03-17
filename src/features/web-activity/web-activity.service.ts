import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import DateUtil from '../../shared/utils/date.utils';
import { decodeDomain } from '../../shared/utils/web-activity.utils';
import { EnrichedEntry } from '../enrichment/models/enriched-entry.model';
import { ActivityDefinitions, IActivityDefinitions } from './activity-definitions.model';
import { passiveAnalysisService } from './passive-analysis.service';
import { IPassiveSession, PassiveSession } from './passive-session.model';
import { WebActivitySyncLog } from './web-activity-sync-log.model';
import { IWebActivityService } from "./web-activity.interfaces";
import { WebActivity } from './web-activity.model';
import { ActivityLimitCheckResult, ActivitySummaryResult, ActivitySyncBatch, BehavioralCluster, IWebActivity, MonthlyActivitySummaryResult, WebActivityDefinitionsDTO, WebActivityDomainLimit } from './web-activity.types';

export class WebActivityService implements IWebActivityService {
    private static readonly DOT_REPLACEMENT = '__dot__';

    /**
     * Get passive enrichment summary for a specific day
     */
    async getPassiveSummary(userId: string, date: string): Promise<Partial<any> | null> {
        try {
            const summary = await EnrichedEntry.findOne({
                userId: new Types.ObjectId(userId),
                sessionId: date,
                sourceType: 'passive'
            }).select('metadata narrative analytics timestamp').lean();

            return summary;
        } catch (error) {
            logger.error('Get passive summary failed:', error);
            throw error;
        }
    }

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

            // 5. Process granular passive events if provided
            if (batch.events && batch.events.length > 0) {
                // Determine analysis asynchronously to not block the fast sync path
                passiveAnalysisService.processEvents(userId, date, batch.events).catch(err => {
                    logger.error('Background passive event analysis failed:', err);
                });
            }

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
     * Get chronologically ordered passive sessions for a day
     */
    async getSessionsByDate(userId: string, date: string): Promise<IPassiveSession[]> {
        try {
            return await (PassiveSession as any).find({ userId, date }).sort({ startTime: 1 }).lean();
        } catch (error) {
            logger.error('Failed to fetch passive sessions:', error);
            throw error;
        }
    }

    /**
     * Get stats for a specific day
     */
    async getStatsByDate(userId: string, date?: string, timezone: string = 'UTC'): Promise<IWebActivity | null> {
        try {
            const targetDate = date || DateUtil.getLocalDateKey(timezone);
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
     * Get or create definitions
     */
    async getDefinitions(userId: string): Promise<IActivityDefinitions> {
        let definitions = await ActivityDefinitions.findOne({
            userId: new Types.ObjectId(userId)
        });

        if (!definitions) {
            definitions = await ActivityDefinitions.create({
                userId: new Types.ObjectId(userId),
                productiveDomains: [],
                distractingDomains: [],
                domainLimits: []
            });
        }

        definitions.productiveDomains = definitions.productiveDomains.map(decodeDomain);
        definitions.distractingDomains = definitions.distractingDomains.map(decodeDomain);
        definitions.domainLimits = definitions.domainLimits.map((limit: any) => ({
            ...limit,
            domain: decodeDomain(limit.domain)
        }));

        return definitions;
    }

    /**
     * Add or update a domain limit
     */
    async upsertDomainLimit(userId: string, data: WebActivityDomainLimit): Promise<IActivityDefinitions> {
        let definitions = await this.getDefinitions(userId);

        const existingIndex = definitions.domainLimits.findIndex(l => l.domain === data.domain);

        if (existingIndex >= 0) {
            definitions.domainLimits[existingIndex].dailyLimitMinutes = data.dailyLimitMinutes;
            definitions.domainLimits[existingIndex].action = data.action;
            if (data.enabled !== undefined) {
                definitions.domainLimits[existingIndex].enabled = data.enabled;
            }
            await definitions.save();
        } else {
            definitions = await ActivityDefinitions.findOneAndUpdate(
                { userId: new Types.ObjectId(userId) },
                { $push: { domainLimits: { domain: data.domain, dailyLimitMinutes: data.dailyLimitMinutes, action: data.action, enabled: data.enabled ?? true } } },
                { upsert: true, new: true }
            ) as IActivityDefinitions;
        }

        return definitions;
    }

    /**
     * Remove a domain limit
     */
    async removeDomainLimit(userId: string, domain: string): Promise<IActivityDefinitions> {
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
    async checkLimits(userId: string, date?: string): Promise<ActivityLimitCheckResult> {
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
                // Look up usage - domain key uses DOT_REPLACEMENT instead of . in domainMap
                const domainKey = limit.domain.replace(/\./g, WebActivityService.DOT_REPLACEMENT);
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
    async getWeeklySummary(userId: string, endDate: string): Promise<ActivitySummaryResult> {
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
                        const decoded = decodeDomain(domain);
                        domainAggregates[decoded] = (domainAggregates[decoded] || 0) + (seconds as number);
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
    async getMonthlySummary(userId: string, year: number, month: number): Promise<MonthlyActivitySummaryResult> {
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
                if (activity.productiveSeconds > (mostProductiveDay?.seconds || 0)) {
                    mostProductiveDay = { date: activity.date, seconds: activity.productiveSeconds };
                }
                if (!leastProductiveDay || activity.productiveSeconds < leastProductiveDay.seconds) {
                    leastProductiveDay = { date: activity.date, seconds: activity.productiveSeconds };
                }

                // Merge domain maps
                if (activity.domainMap) {
                    // Handle Mongoose Map
                    const entries = activity.domainMap instanceof Map
                        ? Array.from(activity.domainMap.entries())
                        : Object.entries(activity.domainMap);

                    for (const [domain, seconds] of entries) {
                        const decoded = decodeDomain(domain);
                        domainAggregates[decoded] = (domainAggregates[decoded] || 0) + (seconds as number);
                    }
                }
            });

            const avgProductivePercent = totalTime > 0 ? (totalProductive / totalTime) * 100 : 0;

            // Sort top domains
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
     * Map-Reduce / Clustering jobs mapping chronological sessions into behavioral insights (Phase 4)
     * e.g., mapping productive vs distracting behavior across days of the week and hours of the day
     */
    async getBehavioralClusters(userId: string, fromDate: string, toDate: string): Promise<BehavioralCluster[]> {
        try {
            const pipeline = [
                {
                    $match: {
                        userId: new Types.ObjectId(userId),
                        date: { $gte: fromDate, $lte: toDate }
                    }
                },
                {
                    $project: {
                        dayOfWeek: { $dayOfWeek: "$startTime" },
                        hourOfDay: { $hour: "$startTime" },
                        category: "$primaryCategory",
                        totalActiveTime: "$metrics.totalActiveTime",
                        flowDuration: "$metrics.flowDuration",
                        contextSwitches: "$metrics.contextSwitchCount"
                    }
                },
                {
                    $group: {
                        _id: {
                            dayOfWeek: "$dayOfWeek",
                            hourOfDay: "$hourOfDay",
                            category: "$category"
                        },
                        sessionCount: { $sum: 1 },
                        totalTime: { $sum: "$totalActiveTime" },
                        avgFlowState: { $avg: "$flowDuration" },
                        totalContextSwitches: { $sum: "$contextSwitches" }
                    }
                },
                {
                    $sort: { "_id.dayOfWeek": 1, "_id.hourOfDay": 1 }
                }
            ];

            const clusters = await PassiveSession.aggregate(pipeline as any);

            return clusters.map(c => ({
                dayOfWeek: c._id.dayOfWeek,
                hourOfDay: c._id.hourOfDay,
                category: c._id.category,
                sessionCount: c.sessionCount,
                totalTimeMins: Math.round(c.totalTime / 60),
                avgFlowStateMins: Math.round(c.avgFlowState / 60),
                totalContextSwitches: c.totalContextSwitches
            }));
        } catch (error) {
            logger.error('Failed to generate behavioral clusters:', error);
            throw error;
        }
    }

    /**
     * Update user-specific activity definitions
     */
    async updateDefinitions(userId: string, data: WebActivityDefinitionsDTO): Promise<IActivityDefinitions | null> {
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
