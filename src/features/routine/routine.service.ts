import { Types } from 'mongoose';
import {
    RoutineTemplate,
    RoutineLog,
    UserRoutinePreferences,
} from './routine.model';
import {
    IRoutineTemplate,
    IRoutineLog,
    IUserRoutinePreferences,
    IRoutineStats,
    IRoutineAnalytics,
    RoutineType,
    IRoutineConfig,
} from '../../shared/types';
import {
    CreateRoutineTemplateParams,
    UpdateRoutineTemplateParams,
    CreateRoutineLogParams,
    UpdateRoutineLogParams,
    GetRoutineLogsQuery,
    GetRoutineStatsQuery,
    GetRoutineAnalyticsQuery,
    UpdateUserRoutinePreferencesParams,
    StreakCalculationResult,
    CompletionCalculationResult,
} from './routine.interfaces';
import { ROUTINE_STATUS } from '../../shared/constants';

export class RoutineService {
    // ============================================
    // ROUTINE TEMPLATE METHODS
    // ============================================

    /**
     * Create a new routine template
     */
    async createRoutineTemplate(
        userId: string,
        params: CreateRoutineTemplateParams
    ): Promise<IRoutineTemplate> {
        const linkedTagIds = params.linkedTags?.map((id) => new Types.ObjectId(id));

        const routine = new RoutineTemplate({
            userId: new Types.ObjectId(userId),
            name: params.name,
            description: params.description,
            icon: params.icon,
            type: params.type,
            config: params.config,
            schedule: params.schedule,
            completionMode: params.completionMode || 'strict',
            gradualThreshold: params.gradualThreshold || 80,
            linkedTags: linkedTagIds,
            order: params.order ?? 0,
            status: ROUTINE_STATUS.ACTIVE,
            streakData: {
                currentStreak: 0,
                longestStreak: 0,
                totalCompletions: 0,
            },
        });

        return await routine.save();
    }

    /**
     * Get all routine templates for a user
     */
    async getRoutineTemplates(
        userId: string,
        status?: string
    ): Promise<IRoutineTemplate[]> {
        const query: any = { userId: new Types.ObjectId(userId) };

        if (status) {
            query.status = status;
        }

        return await RoutineTemplate.find(query)
            .populate('linkedTags', 'name color')
            .sort({ order: 1, createdAt: -1 })
            .lean();
    }

    /**
     * Get a single routine template by ID
     */
    async getRoutineTemplateById(
        userId: string,
        routineId: string
    ): Promise<IRoutineTemplate | null> {
        return await RoutineTemplate.findOne({
            _id: new Types.ObjectId(routineId),
            userId: new Types.ObjectId(userId),
        })
            .populate('linkedTags', 'name color')
            .lean();
    }

    /**
     * Update a routine template
     */
    async updateRoutineTemplate(
        userId: string,
        routineId: string,
        params: UpdateRoutineTemplateParams
    ): Promise<IRoutineTemplate | null> {
        const updateData: any = { ...params };

        if (params.linkedTags) {
            updateData.linkedTags = params.linkedTags.map((id) => new Types.ObjectId(id));
        }

        return await RoutineTemplate.findOneAndUpdate(
            {
                _id: new Types.ObjectId(routineId),
                userId: new Types.ObjectId(userId),
            },
            { $set: updateData },
            { new: true, runValidators: true }
        )
            .populate('linkedTags', 'name color')
            .lean();
    }

    /**
     * Pause a routine template
     */
    async pauseRoutineTemplate(
        userId: string,
        routineId: string
    ): Promise<IRoutineTemplate | null> {
        return await RoutineTemplate.findOneAndUpdate(
            {
                _id: new Types.ObjectId(routineId),
                userId: new Types.ObjectId(userId),
            },
            { $set: { status: ROUTINE_STATUS.PAUSED } },
            { new: true }
        )
            .populate('linkedTags', 'name color')
            .lean();
    }

    /**
     * Archive a routine template
     */
    async archiveRoutineTemplate(
        userId: string,
        routineId: string
    ): Promise<IRoutineTemplate | null> {
        return await RoutineTemplate.findOneAndUpdate(
            {
                _id: new Types.ObjectId(routineId),
                userId: new Types.ObjectId(userId),
            },
            {
                $set: {
                    status: ROUTINE_STATUS.ARCHIVED,
                    archivedAt: new Date(),
                },
            },
            { new: true }
        )
            .populate('linkedTags', 'name color')
            .lean();
    }

    /**
     * Unarchive a routine template
     */
    async unarchiveRoutineTemplate(
        userId: string,
        routineId: string
    ): Promise<IRoutineTemplate | null> {
        return await RoutineTemplate.findOneAndUpdate(
            {
                _id: new Types.ObjectId(routineId),
                userId: new Types.ObjectId(userId),
            },
            {
                $set: {
                    status: ROUTINE_STATUS.ACTIVE,
                },
                $unset: { archivedAt: '' },
            },
            { new: true }
        )
            .populate('linkedTags', 'name color')
            .lean();
    }

    /**
     * Delete a routine template and all its logs
     */
    async deleteRoutineTemplate(
        userId: string,
        routineId: string
    ): Promise<boolean> {
        const routine = await RoutineTemplate.findOneAndDelete({
            _id: new Types.ObjectId(routineId),
            userId: new Types.ObjectId(userId),
        });

        if (routine) {
            // Delete all logs for this routine
            await RoutineLog.deleteMany({
                routineId: new Types.ObjectId(routineId),
                userId: new Types.ObjectId(userId),
            });
            return true;
        }

        return false;
    }

    /**
     * Reorder routine templates
     */
    async reorderRoutineTemplates(
        userId: string,
        routineIds: string[]
    ): Promise<void> {
        const bulkOps = routineIds.map((id, index) => ({
            updateOne: {
                filter: {
                    _id: new Types.ObjectId(id),
                    userId: new Types.ObjectId(userId),
                },
                update: { $set: { order: index } },
            },
        }));

        await RoutineTemplate.bulkWrite(bulkOps);
    }

    // ============================================
    // ROUTINE LOG METHODS
    // ============================================

    /**
     * Create or update a routine log
     */
    async createOrUpdateRoutineLog(
        userId: string,
        params: CreateRoutineLogParams
    ): Promise<IRoutineLog> {
        // Get the routine template
        const routine = await RoutineTemplate.findOne({
            _id: new Types.ObjectId(params.routineId),
            userId: new Types.ObjectId(userId),
        });

        if (!routine) {
            throw new Error('Routine not found');
        }

        // Normalize date to start of day
        const logDate = new Date(params.date);
        logDate.setHours(0, 0, 0, 0);

        // Calculate completion percentage and streak eligibility
        const { completionPercentage, countsForStreak } =
            this.calculateCompletion(routine.type, params.data, routine.config, routine);

        // Check if log already exists
        const existingLog = await RoutineLog.findOne({
            userId: new Types.ObjectId(userId),
            routineId: new Types.ObjectId(params.routineId),
            date: logDate,
        });

        if (existingLog) {
            // Update existing log
            existingLog.data = params.data;
            existingLog.completionPercentage = completionPercentage;
            existingLog.countsForStreak = countsForStreak;
            existingLog.loggedAt = new Date();

            if (params.journalEntryId) {
                existingLog.journalEntryId = new Types.ObjectId(params.journalEntryId);
            }

            await existingLog.save();

            // Recalculate streaks
            await this.recalculateStreaks(userId, params.routineId);

            await existingLog.populate('routineId');
            return existingLog.toObject();
        } else {
            // Create new log
            const log = new RoutineLog({
                userId: new Types.ObjectId(userId),
                routineId: new Types.ObjectId(params.routineId),
                date: logDate,
                data: params.data,
                completionPercentage,
                countsForStreak,
                journalEntryId: params.journalEntryId
                    ? new Types.ObjectId(params.journalEntryId)
                    : undefined,
                loggedAt: new Date(),
            });

            await log.save();

            // Recalculate streaks
            await this.recalculateStreaks(userId, params.routineId);

            await log.populate('routineId');
            return log.toObject();
        }
    }

    /**
     * Get routine logs
     */
    async getRoutineLogs(userId: string, query: GetRoutineLogsQuery): Promise<IRoutineLog[]> {
        const filter: any = { userId: new Types.ObjectId(userId) };

        if (query.routineId) {
            filter.routineId = new Types.ObjectId(query.routineId);
        }

        if (query.date) {
            const baseDate = new Date(query.date);
            // Base date is 00:00:00 UTC of the requested day
            baseDate.setUTCHours(0, 0, 0, 0);

            if (query.timezoneOffset !== undefined) {
                // timezoneOffset is in minutes (e.g., 300 for UTC-5, -300 for UTC+5)
                // We want to find the UTC time that corresponds to 00:00 Local Time
                // Local 00:00 = UTC 00:00 + Offset
                const startMs = baseDate.getTime() + query.timezoneOffset * 60 * 1000;
                const endMs = startMs + 24 * 60 * 60 * 1000 - 1;

                filter.date = {
                    $gte: new Date(startMs),
                    $lte: new Date(endMs),
                };
            } else {
                // Fallback: Check a wider range to catch slight timezone shifts if offset unknown
                // Previous logic extended back 6 hours
                const startDate = new Date(query.date);
                startDate.setHours(-14, 0, 0, 0); // extend back to catch UTC+14
                const endDate = new Date(query.date);
                endDate.setHours(35, 59, 59, 999); // extend forward to catch UTC-12
                // Actually, just standard fallback
                const s = new Date(query.date);
                s.setHours(-6, 0, 0, 0);
                const e = new Date(query.date);
                e.setHours(23, 59, 59, 999);

                filter.date = {
                    $gte: s,
                    $lte: e,
                };
            }
        } else if (query.startDate || query.endDate) {
            filter.date = {};
            if (query.startDate) {
                const startDate = new Date(query.startDate);
                startDate.setHours(0, 0, 0, 0);
                filter.date.$gte = startDate;
            }
            if (query.endDate) {
                const endDate = new Date(query.endDate);
                endDate.setHours(23, 59, 59, 999);
                filter.date.$lte = endDate;
            }
        }

        return await RoutineLog.find(filter)
            .populate('routineId', 'name type icon')
            .sort({ date: -1 })
            .lean();
    }

    /**
     * Update a routine log
     */
    async updateRoutineLog(
        userId: string,
        logId: string,
        params: UpdateRoutineLogParams
    ): Promise<IRoutineLog | null> {
        const log = await RoutineLog.findOne({
            _id: new Types.ObjectId(logId),
            userId: new Types.ObjectId(userId),
        });

        if (!log) {
            return null;
        }

        // Get the routine template
        const routine = await RoutineTemplate.findById(log.routineId);
        if (!routine) {
            throw new Error('Routine not found');
        }

        if (params.data) {
            log.data = params.data;

            // Recalculate completion
            const { completionPercentage, countsForStreak } =
                this.calculateCompletion(routine.type, params.data, routine.config, routine);

            log.completionPercentage = completionPercentage;
            log.countsForStreak = countsForStreak;
        }

        if (params.journalEntryId) {
            log.journalEntryId = new Types.ObjectId(params.journalEntryId);
        }

        log.loggedAt = new Date();

        await log.save();

        // Recalculate streaks
        await this.recalculateStreaks(userId, log.routineId.toString());

        return log.toObject();
    }

    /**
     * Delete a routine log
     */
    async deleteRoutineLog(userId: string, logId: string): Promise<boolean> {
        const log = await RoutineLog.findOneAndDelete({
            _id: new Types.ObjectId(logId),
            userId: new Types.ObjectId(userId),
        });

        if (log) {
            // Recalculate streaks
            await this.recalculateStreaks(userId, log.routineId.toString());
            return true;
        }

        return false;
    }

    // ============================================
    // ANALYTICS & STATS METHODS
    // ============================================

    /**
     * Get routine statistics
     */
    async getRoutineStats(
        userId: string,
        routineId: string,
        query: GetRoutineStatsQuery
    ): Promise<IRoutineStats> {
        const routine = await RoutineTemplate.findOne({
            _id: new Types.ObjectId(routineId),
            userId: new Types.ObjectId(userId),
        });

        if (!routine) {
            throw new Error('Routine not found');
        }

        // Determine date range
        let startDate: Date;
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        if (query.startDate && query.endDate) {
            startDate = new Date(query.startDate);
            endDate.setTime(new Date(query.endDate).getTime());
        } else {
            switch (query.period) {
                case 'week':
                    startDate = new Date();
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case 'month':
                    startDate = new Date();
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
                case 'year':
                    startDate = new Date();
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    break;
                default:
                    startDate = new Date(routine.createdAt);
            }
        }

        startDate.setHours(0, 0, 0, 0);

        // Get logs in date range
        const logs = await RoutineLog.find({
            userId: new Types.ObjectId(userId),
            routineId: new Types.ObjectId(routineId),
            date: { $gte: startDate, $lte: endDate },
        })
            .sort({ date: -1 })
            .lean();

        // Calculate completion rate
        const completedLogs = logs.filter((log) => log.countsForStreak);
        const completionRate =
            logs.length > 0 ? (completedLogs.length / logs.length) * 100 : 0;

        // Get weekly trend (last 7 days)
        const weeklyTrend: number[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);

            const dayLog = logs.find(
                (log) => log.date.getTime() === date.getTime()
            );

            weeklyTrend.push(dayLog?.completionPercentage || 0);
        }

        return {
            completionRate: Math.round(completionRate * 10) / 10,
            currentStreak: routine.streakData.currentStreak,
            longestStreak: routine.streakData.longestStreak,
            totalCompletions: routine.streakData.totalCompletions,
            recentLogs: logs.slice(0, 10),
            weeklyTrend,
        };
    }

    /**
     * Get overall routine analytics
     */
    async getRoutineAnalytics(
        userId: string,
        query: GetRoutineAnalyticsQuery
    ): Promise<IRoutineAnalytics> {
        // Get all active routines
        const routines = await RoutineTemplate.find({
            userId: new Types.ObjectId(userId),
            status: ROUTINE_STATUS.ACTIVE,
        }).lean();

        // Determine date range
        let startDate: Date;
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        switch (query.period) {
            case 'week':
                startDate = new Date();
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate = new Date();
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case 'year':
                startDate = new Date();
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            default:
                startDate = new Date();
                startDate.setMonth(startDate.getMonth() - 1);
        }

        startDate.setHours(0, 0, 0, 0);

        // Get all logs in date range
        const allLogs = await RoutineLog.find({
            userId: new Types.ObjectId(userId),
            date: { $gte: startDate, $lte: endDate },
        }).lean();

        // Calculate overall completion rate
        const completedLogs = allLogs.filter((log) => log.countsForStreak);
        const overallCompletionRate =
            allLogs.length > 0 ? (completedLogs.length / allLogs.length) * 100 : 0;

        // Calculate per-routine breakdown
        const routineBreakdown = await Promise.all(
            routines.map(async (routine) => {
                const routineLogs = allLogs.filter(
                    (log) => log.routineId.toString() === routine._id.toString()
                );

                const routineCompletedLogs = routineLogs.filter(
                    (log) => log.countsForStreak
                );

                const completionRate =
                    routineLogs.length > 0
                        ? (routineCompletedLogs.length / routineLogs.length) * 100
                        : 0;

                return {
                    routine,
                    completionRate: Math.round(completionRate * 10) / 10,
                    streak: routine.streakData.currentStreak,
                };
            })
        );

        return {
            overallCompletionRate: Math.round(overallCompletionRate * 10) / 10,
            totalActiveRoutines: routines.length,
            routineBreakdown,
        };
    }

    // ============================================
    // USER PREFERENCES METHODS
    // ============================================

    /**
     * Get user routine preferences
     */
    async getUserRoutinePreferences(
        userId: string
    ): Promise<IUserRoutinePreferences> {
        let preferences = await UserRoutinePreferences.findOne({
            userId: new Types.ObjectId(userId),
        }).lean();

        if (!preferences) {
            // Create default preferences
            const newPreferences = new UserRoutinePreferences({
                userId: new Types.ObjectId(userId),
                reminders: {
                    enabled: false,
                    smartReminders: false,
                    customReminders: [],
                },
                defaultView: 'list',
                showStreaksOnCalendar: true,
            });

            preferences = await newPreferences.save();
        }

        return preferences;
    }

    /**
     * Update user routine preferences
     */
    async updateUserRoutinePreferences(
        userId: string,
        params: UpdateUserRoutinePreferencesParams
    ): Promise<IUserRoutinePreferences> {
        const updateData: any = {};

        if (params.reminders) {
            if (params.reminders.customReminders) {
                updateData['reminders.customReminders'] =
                    params.reminders.customReminders.map((reminder) => ({
                        ...reminder,
                        routineId: new Types.ObjectId(reminder.routineId),
                    }));
            }

            if (params.reminders.enabled !== undefined) {
                updateData['reminders.enabled'] = params.reminders.enabled;
            }

            if (params.reminders.dailyReminderTime !== undefined) {
                updateData['reminders.dailyReminderTime'] =
                    params.reminders.dailyReminderTime;
            }

            if (params.reminders.smartReminders !== undefined) {
                updateData['reminders.smartReminders'] = params.reminders.smartReminders;
            }
        }

        if (params.defaultView) {
            updateData.defaultView = params.defaultView;
        }

        if (params.showStreaksOnCalendar !== undefined) {
            updateData.showStreaksOnCalendar = params.showStreaksOnCalendar;
        }

        const preferences = await UserRoutinePreferences.findOneAndUpdate(
            { userId: new Types.ObjectId(userId) },
            { $set: updateData },
            { new: true, upsert: true, runValidators: true }
        ).lean();

        return preferences!;
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    /**
     * Calculate completion percentage and streak eligibility
     */
    private calculateCompletion(
        type: RoutineType,
        data: any,
        config: IRoutineConfig,
        routine: IRoutineTemplate
    ): CompletionCalculationResult {
        let completionPercentage = 0;

        switch (type) {
            case 'boolean':
                completionPercentage = data.completed ? 100 : 0;
                break;

            case 'checklist':
                if (data.checkedItems && config.items) {
                    const checked = data.checkedItems.filter(Boolean).length;
                    completionPercentage = (checked / config.items.length) * 100;
                }
                break;

            case 'counter':
            case 'duration':
                if (data.value !== undefined && config.target) {
                    completionPercentage = Math.min((data.value / config.target) * 100, 100);
                }
                break;

            case 'scale':
                completionPercentage = data.value !== undefined ? 100 : 0;
                break;

            case 'text':
                completionPercentage =
                    data.text && data.text.trim() ? 100 : 0;
                break;

            case 'time':
                completionPercentage =
                    data.time && data.time.trim() ? 100 : 0;
                break;
        }

        // Determine if counts for streak
        let countsForStreak = false;
        if (routine.completionMode === 'strict') {
            countsForStreak = completionPercentage === 100;
        } else {
            const threshold = routine.gradualThreshold || 80;
            countsForStreak = completionPercentage >= threshold;
        }

        return {
            completionPercentage: Math.round(completionPercentage * 10) / 10,
            countsForStreak,
        };
    }

    /**
     * Recalculate streaks for a routine
     */
    private async recalculateStreaks(userId: string, routineId: string): Promise<void> {
        const routine = await RoutineTemplate.findOne({
            _id: new Types.ObjectId(routineId),
            userId: new Types.ObjectId(userId),
        });

        if (!routine) {
            return;
        }

        const activeDays = routine.schedule.activeDays;
        if (!activeDays || activeDays.length === 0) return;

        // Fetch logs sorted by date descending
        const logs = await RoutineLog.find({
            userId: new Types.ObjectId(userId),
            routineId: new Types.ObjectId(routineId),
            countsForStreak: true,
        })
            .sort({ date: -1 })
            .lean();

        if (logs.length === 0) {
            await RoutineTemplate.findByIdAndUpdate(routineId, {
                $set: {
                    'streakData.currentStreak': 0,
                    'streakData.longestStreak': 0,
                    'streakData.totalCompletions': 0,
                    'streakData.lastCompletedDate': null,
                },
            });
            return;
        }

        // 1. Deduplicate Logs (Fix Db Sync Issues)
        // We assume logs within 18 hours of each other are for the same "effective day" given the timezone shifts seen.
        const uniqueLogs: typeof logs = [];
        const idsToDelete: Types.ObjectId[] = [];

        if (logs.length > 0) {
            uniqueLogs.push(logs[0]);
            let lastLogTime = new Date(logs[0].date).getTime();

            for (let i = 1; i < logs.length; i++) {
                const currentLogTime = new Date(logs[i].date).getTime();
                const diffHours = (lastLogTime - currentLogTime) / (1000 * 60 * 60);

                if (diffHours < 18) {
                    // Duplicate/Same day entry
                    idsToDelete.push(logs[i]._id as unknown as Types.ObjectId);
                } else {
                    uniqueLogs.push(logs[i]);
                    lastLogTime = currentLogTime;
                }
            }
        }

        // Clean up duplicates if any
        if (idsToDelete.length > 0) {
            await RoutineLog.deleteMany({ _id: { $in: idsToDelete } });
        }

        // 2. Helper for day comparison
        // Returns approximate difference in calendar days
        const getDiffDays = (d1: Date, d2: Date): number => {
            const msPerDay = 1000 * 60 * 60 * 24;
            // Use UTC to avoid DST weirdness, but here we rely on the rough difference
            return Math.round((d1.getTime() - d2.getTime()) / msPerDay);
        };

        // Check if a gap of days contains any active days (streak breaker)
        // start matches the 'more recent' date, end matches the 'older' date
        const isGapSafe = (startDate: Date, gapInDays: number): boolean => {
            // We need to check the days BETWEEN startDate and (startDate - gap)
            // Example: Today Mon. Last log Sat. Gap = 2 days.
            // Check Sunday.
            // dateCursor starts at startDate - 1 day.

            const dateCursor = new Date(startDate);

            for (let i = 1; i < gapInDays; i++) {
                dateCursor.setDate(dateCursor.getDate() - 1);
                // Check if this intermediate day was an active day
                if (activeDays.includes(dateCursor.getDay())) {
                    return false; // Found a missed active day!
                }
            }
            return true;
        };

        // 3. Calculate Streaks
        let longestStreak = 0;
        let currentStreak = 0;
        let tempStreak = 1; // Start with 1 for the first log in a segment

        // Iterate unique logs to find longest streak
        if (uniqueLogs.length > 0) {
            for (let i = 0; i < uniqueLogs.length - 1; i++) {
                const recent = new Date(uniqueLogs[i].date);
                const older = new Date(uniqueLogs[i + 1].date);
                const diff = getDiffDays(recent, older);

                if (diff === 1) {
                    // Consecutive
                    tempStreak++;
                } else {
                    // Gap > 1. Check if safe (only inactive days in between)
                    if (isGapSafe(recent, diff)) {
                        tempStreak++;
                    } else {
                        // Streak broken
                        longestStreak = Math.max(longestStreak, tempStreak);
                        tempStreak = 1;
                    }
                }
            }
            longestStreak = Math.max(longestStreak, tempStreak);
        }

        // 4. Determine Current Streak
        if (uniqueLogs.length > 0) {
            const now = new Date();
            const lastLogDate = new Date(uniqueLogs[0].date);
            const diffFromNow = getDiffDays(now, lastLogDate);

            // 0 = Today, 1 = Yesterday
            if (diffFromNow <= 0) {
                // Done today (or future? treat as today)
                // Re-run segment count for head
                let headStreak = 1;
                for (let i = 0; i < uniqueLogs.length - 1; i++) {
                    const recent = new Date(uniqueLogs[i].date);
                    const older = new Date(uniqueLogs[i + 1].date);
                    const diff = getDiffDays(recent, older);
                    if (diff === 1 || isGapSafe(recent, diff)) {
                        headStreak++;
                    } else {
                        break;
                    }
                }
                currentStreak = headStreak;

            } else if (diffFromNow === 1) {
                // Done yesterday. Streak valid.
                let headStreak = 1;
                for (let i = 0; i < uniqueLogs.length - 1; i++) {
                    const recent = new Date(uniqueLogs[i].date);
                    const older = new Date(uniqueLogs[i + 1].date);
                    const diff = getDiffDays(recent, older);
                    if (diff === 1 || isGapSafe(recent, diff)) {
                        headStreak++;
                    } else {
                        break;
                    }
                }
                currentStreak = headStreak;
            } else {
                // Gap > 1 day from Now. Check if safe.
                if (isGapSafe(now, diffFromNow)) {
                    // It is safe! (e.g. we haven't logged for 2 days but they were weekends/off-days)
                    let headStreak = 1;

                    for (let i = 0; i < uniqueLogs.length - 1; i++) {
                        const recent = new Date(uniqueLogs[i].date);
                        const older = new Date(uniqueLogs[i + 1].date);
                        const diff = getDiffDays(recent, older);
                        if (diff === 1 || isGapSafe(recent, diff)) {
                            headStreak++;
                        } else {
                            break;
                        }
                    }
                    currentStreak = headStreak;
                } else {
                    currentStreak = 0;
                }
            }
        }

        // Update Routine
        await RoutineTemplate.findByIdAndUpdate(routineId, {
            $set: {
                'streakData.currentStreak': currentStreak,
                'streakData.longestStreak': longestStreak,
                'streakData.totalCompletions': uniqueLogs.length,
                'streakData.lastCompletedDate': uniqueLogs.length > 0 ? uniqueLogs[0].date : undefined,
            },
        });
    }


}

export default new RoutineService();
