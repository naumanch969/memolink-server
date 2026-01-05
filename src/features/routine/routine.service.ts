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

            return log.toObject();
        }
    }

    /**
     * Get routine logs
     */
    async getRoutineLogs(
        userId: string,
        query: GetRoutineLogsQuery
    ): Promise<IRoutineLog[]> {
        const filter: any = { userId: new Types.ObjectId(userId) };

        if (query.routineId) {
            filter.routineId = new Types.ObjectId(query.routineId);
        }

        if (query.date) {
            const date = new Date(query.date);
            date.setHours(0, 0, 0, 0);
            filter.date = date;
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
    private async recalculateStreaks(
        userId: string,
        routineId: string
    ): Promise<void> {
        const routine = await RoutineTemplate.findOne({
            _id: new Types.ObjectId(routineId),
            userId: new Types.ObjectId(userId),
        });

        if (!routine) {
            return;
        }

        // Get all logs that count for streak, sorted by date descending
        const logs = await RoutineLog.find({
            userId: new Types.ObjectId(userId),
            routineId: new Types.ObjectId(routineId),
            countsForStreak: true,
        })
            .sort({ date: -1 })
            .lean();

        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let expectedDate = new Date(today);

        // Move to previous scheduled day if today is not scheduled
        while (!routine.schedule.activeDays.includes(expectedDate.getDay())) {
            expectedDate.setDate(expectedDate.getDate() - 1);
        }

        for (const log of logs) {
            const logDate = new Date(log.date);
            logDate.setHours(0, 0, 0, 0);

            // Check if log date matches expected date
            if (logDate.getTime() === expectedDate.getTime()) {
                tempStreak++;
                if (currentStreak === 0) {
                    currentStreak = tempStreak;
                }

                // Move to previous scheduled day
                do {
                    expectedDate.setDate(expectedDate.getDate() - 1);
                } while (!routine.schedule.activeDays.includes(expectedDate.getDay()));
            } else {
                // Streak broken
                longestStreak = Math.max(longestStreak, tempStreak);
                tempStreak = 0;
                currentStreak = 0;
                break;
            }
        }

        longestStreak = Math.max(longestStreak, tempStreak);

        // Update routine with new streak data
        await RoutineTemplate.findByIdAndUpdate(routineId, {
            $set: {
                'streakData.currentStreak': currentStreak,
                'streakData.longestStreak': Math.max(
                    longestStreak,
                    routine.streakData.longestStreak
                ),
                'streakData.totalCompletions': logs.length,
                'streakData.lastCompletedDate': logs.length > 0 ? logs[0].date : undefined,
            },
        });
    }
}

export default new RoutineService();
