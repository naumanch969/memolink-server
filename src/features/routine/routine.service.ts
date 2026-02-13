import mongoose, { ClientSession, FilterQuery, Types } from 'mongoose';
import { logger } from '../../config/logger';
import DateManager from '../../core/utils/DateManager';
import { ROUTINE_STATUS } from '../../shared/constants';
import { DataType } from '../../shared/types';
import { IChecklistConfig, ICounterConfig } from '../../shared/types/dataProperties';
import { goalService } from '../goal/goal.service';
import { CompletionCalculationResult, CreateRoutineLogParams, CreateRoutineTemplateParams, GetRoutineAnalyticsQuery, GetRoutineLogsQuery, GetRoutineStatsQuery, IRoutineAnalytics, IRoutineConfig, IRoutineLog, IRoutineStats, IRoutineTemplate, IUserRoutinePreferences, RoutineType, UpdateRoutineLogParams, UpdateRoutineTemplateParams, UpdateUserRoutinePreferencesParams } from './routine.interfaces';
import { RoutineLog, RoutineTemplate, UserRoutinePreferences, } from './routine.model';

const DEFAULT_GRADUAL_THRESHOLD = 80;
const DEFAULT_COMPLETION_MODE = 'strict';

export class RoutineService {
    /**
     * Create a new routine template
     */
    async createRoutineTemplate(userId: string, params: CreateRoutineTemplateParams): Promise<IRoutineTemplate> {
        const linkedTagIds = params.linkedTags?.map((id) => new Types.ObjectId(id));

        const routine = new RoutineTemplate({
            userId: new Types.ObjectId(userId),
            name: params.name,
            description: params.description,
            icon: params.icon,
            type: params.type,
            config: params.config,
            schedule: params.schedule,
            completionMode: params.completionMode || DEFAULT_COMPLETION_MODE,
            gradualThreshold: params.gradualThreshold || DEFAULT_GRADUAL_THRESHOLD,
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
    async getRoutineTemplates(userId: string, status?: string): Promise<IRoutineTemplate[]> {
        const query: FilterQuery<IRoutineTemplate> = { userId: new Types.ObjectId(userId) };

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
    async getRoutineTemplateById(userId: string, routineId: string): Promise<IRoutineTemplate | null> {
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
    async updateRoutineTemplate(userId: string, routineId: string, params: UpdateRoutineTemplateParams): Promise<IRoutineTemplate | null> {
        const updateData: Record<string, any> = { ...params };

        if (params.linkedTags) {
            updateData.linkedTags = params.linkedTags.map((id) => new Types.ObjectId(id));
        }

        const result = await RoutineTemplate.findOneAndUpdate(
            { _id: new Types.ObjectId(routineId), userId: new Types.ObjectId(userId), },
            { $set: updateData },
            { new: true, runValidators: true }
        )
            .populate('linkedTags', 'name color')
            .lean();

        // Refresh today's logs to match new config
        if (updateData.config) {
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            const logs = await RoutineLog.find({
                userId: new Types.ObjectId(userId),
                routineId: new Types.ObjectId(routineId),
                date: { $gte: startOfToday }
            });

            // Reuse the updated routine for calculation (we need the Document, not lean)
            const updatedRoutine = await RoutineTemplate.findById(routineId);

            for (const log of logs) {
                if (!updatedRoutine) continue;

                const { completionPercentage, countsForStreak } = this.calculateCompletion(
                    updatedRoutine.type as RoutineType,
                    log.data,
                    updatedRoutine.config,
                    updatedRoutine,
                    log.date
                );

                log.completionPercentage = completionPercentage;
                log.countsForStreak = countsForStreak;

                await log.save();
            }

            if (logs.length > 0) {
                // FIXED: Use transactional approach ideally, but for now just await
                await this.recalculateStreaks(userId, routineId);
            }
        }

        return result;
    }

    // ... (omitted methods: pause, archive, unarchive, delete, reorder, createOrUpdateRoutineLog, getRoutineLogs, updateRoutineLog, deleteRoutineLog, getRoutineStats, getRoutineAnalytics, getUserRoutinePreferences, updateUserRoutinePreferences, calculateCompletion) Use placeholders if strict context limit, but I'll focus on the critical methods below

    /**
     * Pause a routine template
     */
    async pauseRoutineTemplate(userId: string, routineId: string): Promise<IRoutineTemplate | null> {
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
    async archiveRoutineTemplate(userId: string, routineId: string): Promise<IRoutineTemplate | null> {
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
    async unarchiveRoutineTemplate(userId: string, routineId: string): Promise<IRoutineTemplate | null> {
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
     * Ensures linked goals are updated to remove progress contributed by this routine
     */
    async deleteRoutineTemplate(userId: string, routineId: string): Promise<boolean> {
        const routine = await RoutineTemplate.findOne({
            _id: new Types.ObjectId(routineId),
            userId: new Types.ObjectId(userId),
        });

        if (!routine) return false;

        // 1. Calculate total contribution of all logs to subtract from goals
        const logs = await RoutineLog.find({
            routineId: routine._id,
            userId: routine.userId
        });

        let totalDelta = 0;
        for (const log of logs) {
            totalDelta += this.calculateDelta(routine.type as RoutineType, log.data, null);
        }

        if (totalDelta !== 0) {
            const linkedGoalIds = routine.linkedGoals?.map(id => id.toString()) || [];
            await goalService.updateProgressFromRoutineLog(
                userId,
                routineId,
                routine.type as RoutineType,
                totalDelta,
                linkedGoalIds
            );
        }

        // 2. Delete routine and logs
        await RoutineLog.deleteMany({
            routineId: routine._id,
            userId: routine.userId,
        });

        await RoutineTemplate.deleteOne({ _id: routine._id });

        // 3. Cleanup linked references in goals
        await goalService.removeLinkedRoutine(routineId);

        return true;
    }

    /**
     * Reorder routine templates
     */
    async reorderRoutineTemplates(userId: string, routineIds: string[]): Promise<void> {
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
    async createOrUpdateRoutineLog(userId: string, params: CreateRoutineLogParams): Promise<IRoutineLog> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Get the routine template - strictly within session
            const routine = await RoutineTemplate.findOne({
                _id: new Types.ObjectId(params.routineId),
                userId: new Types.ObjectId(userId),
            }).session(session);

            if (!routine) {
                throw new Error('Routine not found');
            }

            // Normalize date to 00:00:00 UTC to match search/filter logic
            const logDate = DateManager.normalizeToUTC(params.date);

            // Calculate completion percentage and streak eligibility
            const { completionPercentage, countsForStreak } =
                this.calculateCompletion(routine.type as RoutineType, params.data, routine.config, routine, logDate);

            // Fetch existing log within session to calculate delta for goal updates
            const existingLog = await RoutineLog.findOne({
                userId: new Types.ObjectId(userId),
                routineId: new Types.ObjectId(params.routineId),
                date: logDate,
            }).session(session);

            const delta = this.calculateDelta(routine.type as RoutineType, existingLog?.data, params.data);
            if (delta !== 0) {
                await goalService.updateProgressFromRoutineLog(
                    userId,
                    params.routineId,
                    routine.type as RoutineType,
                    delta,
                    [], // linkedGoalIds (routine template link handles this typically)
                    session
                );
            }

            const updateOps: any = {
                $set: {
                    data: params.data,
                    completionPercentage,
                    countsForStreak,
                    loggedAt: new Date(),
                }
            };

            if (params.journalEntryId) {
                updateOps.$set.journalEntryId = new Types.ObjectId(params.journalEntryId);
            }

            // Atomic Upsert within Transaction
            const log = await RoutineLog.findOneAndUpdate(
                {
                    userId: new Types.ObjectId(userId),
                    routineId: new Types.ObjectId(params.routineId),
                    date: logDate,
                },
                updateOps,
                {
                    new: true,
                    upsert: true,
                    runValidators: true,
                    setDefaultsOnInsert: true,
                    session // CRITICAL: Link to transaction
                }
            ).populate('routineId');

            if (!log) throw new Error('Failed to create or update routine log');

            // Recalculate streaks with timezone awareness - within session
            await this.recalculateStreaks(userId, params.routineId, params.timezoneOffset, session);

            await session.commitTransaction();
            return log.toObject();

        } catch (error) {
            await session.abortTransaction();
            logger.error(`Transaction aborted in createOrUpdateRoutineLog: ${error}`);
            throw error;
        } finally {
            await session.endSession();
        }
    }

    /**
     * Get routine logs
     */
    async getRoutineLogs(userId: string, query: GetRoutineLogsQuery): Promise<IRoutineLog[]> {
        const filter: any = { userId: new Types.ObjectId(userId) };

        if (query.routineIds) {
            const ids = Array.isArray(query.routineIds)
                ? query.routineIds
                // If it comes as a string (comma separated or single), split it
                : (query.routineIds as string).split(',');

            filter.routineId = { $in: ids.map(id => new Types.ObjectId(id.trim())) };
        } else if (query.routineId) {
            filter.routineId = new Types.ObjectId(query.routineId);
        }

        if (query.date) {
            const baseDate = new Date(query.date);
            // Base date is 00:00:00 UTC of the requested day
            baseDate.setUTCHours(0, 0, 0, 0);

            if (query.timezoneOffset !== undefined) {
                // Timezone adjustment logic
                // If the user provides timezoneOffset, we adjust the SEARCH RANGE, but stored dates are UTC 00:00.
                // However, RoutineLog model forces stored date to be 00:00:00.
                // So strict equality on date is usually safer for 'single day' logs.
                // But for safety, we search the 24h window in UTC.

                const dayStart = new Date(baseDate);
                const dayEnd = new Date(baseDate);
                dayEnd.setUTCHours(23, 59, 59, 999);

                filter.date = {
                    $gte: dayStart,
                    $lte: dayEnd,
                };
            } else {
                // Fallback: Strict match on the provided ISO date string normalized to start of day
                const d = new Date(query.date);
                d.setUTCHours(0, 0, 0, 0);
                filter.date = d;
            }
        } else if (query.startDate || query.endDate) {
            filter.date = {};
            if (query.startDate) {
                const startDate = new Date(query.startDate);
                startDate.setUTCHours(0, 0, 0, 0);
                filter.date.$gte = startDate;
            }
            if (query.endDate) {
                const endDate = new Date(query.endDate);
                endDate.setUTCHours(23, 59, 59, 999);
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
    async updateRoutineLog(userId: string, logId: string, params: UpdateRoutineLogParams): Promise<IRoutineLog | null> {

        const log = await RoutineLog.findOne({ _id: new Types.ObjectId(logId), userId: new Types.ObjectId(userId), });

        if (!log) {
            return null;
        }

        // Get the routine template
        const routine = await RoutineTemplate.findById(log.routineId);
        if (!routine) {
            throw new Error('Routine not found');
        }

        if (params.data) {
            const oldData = log.data;
            // Merge old and new data to ensure we don't lose the value field
            log.data = {
                value: params.data.value !== undefined ? params.data.value : oldData.value,
                notes: params.data.notes !== undefined ? params.data.notes : oldData.notes
            };

            // Recalculate completion
            const { completionPercentage, countsForStreak } = this.calculateCompletion(routine.type as RoutineType, log.data, routine.config, routine, log.date);

            log.completionPercentage = completionPercentage;
            log.countsForStreak = countsForStreak;

            // Calculate delta and update goals
            const delta = this.calculateDelta(routine.type as RoutineType, oldData, log.data);
            if (delta !== 0) {
                // Pass linked goals for update
                const linkedGoalIds = routine.linkedGoals?.map(id => id.toString()) || [];

                await goalService.updateProgressFromRoutineLog(
                    userId,
                    log.routineId.toString(),
                    routine.type as RoutineType,
                    delta,
                    linkedGoalIds
                );
            }
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
        const log = await RoutineLog.findOne({
            _id: new Types.ObjectId(logId),
            userId: new Types.ObjectId(userId),
        });

        if (!log) return false;

        // Get the routine template to find linked goals
        const routine = await RoutineTemplate.findById(log.routineId);

        // Calculate negative delta to subtract from goals
        const delta = this.calculateDelta(routine?.type as RoutineType, log.data, null);

        if (delta !== 0) {
            const linkedGoalIds = routine?.linkedGoals?.map(id => id.toString()) || [];
            await goalService.updateProgressFromRoutineLog(
                userId,
                log.routineId.toString(),
                routine?.type as RoutineType,
                delta,
                linkedGoalIds
            );
        }

        await RoutineLog.deleteOne({ _id: log._id });

        // Recalculate streaks
        await this.recalculateStreaks(userId, log.routineId.toString());
        return true;
    }

    // ============================================
    // ANALYTICS & STATS METHODS
    // ============================================

    /**
     * Get routine statistics
     */
    async getRoutineStats(userId: string, routineId: string, query: GetRoutineStatsQuery): Promise<IRoutineStats> {
        const routine = await RoutineTemplate.findOne({
            _id: new Types.ObjectId(routineId),
            userId: new Types.ObjectId(userId),
        });

        if (!routine) {
            throw new Error('Routine not found');
        }

        // Determine date range
        let startDate: Date;
        const endDate = new Date(); // Right now (local) -> convert to UTC end of day? 
        // Actually for "today", we accept up to current moment.
        // But for filtering logs stored as 00:00 UTC, we should ensure cover.
        endDate.setUTCHours(23, 59, 59, 999);

        if (query.startDate && query.endDate) {
            startDate = new Date(query.startDate);
            const e = new Date(query.endDate);
            e.setUTCHours(23, 59, 59, 999);
            endDate.setTime(e.getTime());
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

        startDate.setUTCHours(0, 0, 0, 0);

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
        today.setUTCHours(0, 0, 0, 0);

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
    async getRoutineAnalytics(userId: string, query: GetRoutineAnalyticsQuery): Promise<IRoutineAnalytics> {
        // Get all active routines
        const routines = await RoutineTemplate.find({
            userId: new Types.ObjectId(userId),
            status: ROUTINE_STATUS.ACTIVE,
        }).lean();

        // Determine date range
        let startDate: Date;
        const endDate = new Date();
        endDate.setUTCHours(23, 59, 59, 999);

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

        startDate.setUTCHours(0, 0, 0, 0);

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
    async getUserRoutinePreferences(userId: string): Promise<IUserRoutinePreferences> {
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
    async updateUserRoutinePreferences(userId: string, params: UpdateUserRoutinePreferencesParams): Promise<IUserRoutinePreferences> {
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
     * Calculate delta between old and new data for goal updates
     */
    private calculateDelta(type: RoutineType, oldData: any, newData: any): number {
        const oldVal = oldData || {};
        const newVal = newData || {};

        if (type === 'counter' || type === 'duration' || type === 'scale') {
            const oldV = Number(oldVal.value) || 0;
            const newV = Number(newVal.value) || 0;
            return newV - oldV;
        }

        if (type === 'boolean') {
            const oldBlean = !!oldVal.value;
            const newBlean = !!newVal.value;
            if (newBlean === oldBlean) return 0;
            return newBlean ? 1 : -1;
        }

        if (type === 'checklist') {
            // Count checked items
            const oldChecked = (Array.isArray(oldVal.value) ? oldVal.value : []).filter(Boolean).length;
            const newChecked = (Array.isArray(newVal.value) ? newVal.value : []).filter(Boolean).length;
            return newChecked - oldChecked;
        }

        return 0;
    }

    /**
     * Calculate completion percentage and streak eligibility
     */
    private calculateCompletion(type: RoutineType, data: any, defaultConfig: IRoutineConfig, routine: IRoutineTemplate, date?: Date): CompletionCalculationResult {
        // Resolve correct config based on date if provided
        // Post-migration simplification: Always use the current routine config
        const config = defaultConfig;

        let completionPercentage = 0;
        switch (type) {
            case DataType.BOOLEAN:
                completionPercentage = data.value ? 100 : 0;
                break;

            case DataType.CHECKLIST:
                if (data.value && (config as IChecklistConfig).items) {
                    const checked = (data.value as boolean[]).filter(Boolean).length;
                    completionPercentage = (checked / (config as IChecklistConfig).items.length) * 100;
                }
                break;

            case DataType.COUNTER:
            case DataType.DURATION:
                if (data.value !== undefined) {
                    // Use target from resolved config
                    const target = (config as ICounterConfig).target || 1;
                    completionPercentage = Math.min(((data.value as number) / target) * 100, 100);
                }
                break;

            case DataType.SCALE:
                completionPercentage = data.value !== undefined ? 100 : 0;
                break;

            case DataType.TEXT:
                completionPercentage =
                    data.value && (data.value as string).trim() ? 100 : 0;
                break;

            case DataType.TIME:
                completionPercentage =
                    data.value && (data.value as string).trim() ? 100 : 0;
                break;
        }

        // Determine if counts for streak
        let countsForStreak = false;
        const DEFAULT_GRADUAL_THRESHOLD = 80;

        if (routine.completionMode === 'strict') {
            countsForStreak = completionPercentage === 100;
        } else {
            const threshold = routine.gradualThreshold || DEFAULT_GRADUAL_THRESHOLD;
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
    private async recalculateStreaks(userId: string, routineId: string, timezoneOffset?: number, session?: ClientSession): Promise<void> {
        const routine = await RoutineTemplate.findOne({
            _id: new Types.ObjectId(routineId),
            userId: new Types.ObjectId(userId),
        }).session(session || null);

        if (!routine) return;

        const logs = await RoutineLog.find({
            userId: new Types.ObjectId(userId),
            routineId: new Types.ObjectId(routineId),
            countsForStreak: true,
        })
            .sort({ date: -1 })
            .session(session || null)
            .lean();

        // Calculate User's current day based on timezoneOffset
        const referenceNow = DateManager.getReferenceNow(timezoneOffset);

        if (logs.length === 0) {
            await RoutineTemplate.findByIdAndUpdate(routineId, {
                $set: {
                    'streakData.currentStreak': 0,
                    'streakData.longestStreak': 0,
                    'streakData.totalCompletions': 0,
                    'streakData.lastCompletedDate': undefined,
                    'streakData.bankedSkips': 0,
                },
            }, { session });
            return;
        }

        // 1. Deduplicate/Normalize Logs
        const uniqueDaysSet = new Set<string>();
        const uniqueLogs: typeof logs = [];

        for (const log of logs) {
            const dayKey = new Date(log.date).toISOString().split('T')[0];
            if (!uniqueDaysSet.has(dayKey)) {
                uniqueDaysSet.add(dayKey);
                uniqueLogs.push(log);
            }
        }

        // Logic split based on Schedule Type
        let currentStreak = 0;
        let longestStreak = 0;

        if (routine.schedule.type === 'frequency') {
            const { current, longest } = await this.calculateFrequencyStreaks(routine, uniqueLogs, referenceNow);
            currentStreak = current;
            longestStreak = longest;
        } else {
            const { current, longest } = this.calculateDayStreaks(routine, uniqueLogs, referenceNow);
            currentStreak = current;
            longestStreak = longest;
        }

        // Update Routine
        await RoutineTemplate.findByIdAndUpdate(routineId, {
            $set: {
                'streakData.currentStreak': currentStreak,
                'streakData.longestStreak': longestStreak,
                'streakData.totalCompletions': logs.length,
                'streakData.lastCompletedDate': logs.length > 0 ? logs[0].date : undefined,
            },
        }, { session });
    }

    private calculateDayStreaks(routine: IRoutineTemplate, uniqueLogs: any[], referenceNow: Date): { current: number, longest: number } {
        let longestStreak = 0;
        let currentStreak = 0;

        // Longest Streak
        if (uniqueLogs.length > 0) {
            let tempStreak = 1;
            for (let i = 0; i < uniqueLogs.length - 1; i++) {
                const recent = new Date(uniqueLogs[i].date);
                const older = new Date(uniqueLogs[i + 1].date);
                const diff = DateManager.getDiffDays(recent, older);

                if (diff === 1 || (diff > 1 && this.isGapSafe(recent, diff, routine))) {
                    tempStreak++;
                } else {
                    longestStreak = Math.max(longestStreak, tempStreak);
                    tempStreak = 1;
                }
            }
            longestStreak = Math.max(longestStreak, tempStreak);
        }

        // Current Streak
        if (uniqueLogs.length > 0) {
            const lastLogDate = new Date(uniqueLogs[0].date);
            lastLogDate.setUTCHours(0, 0, 0, 0);

            const diffFromNow = DateManager.getDiffDays(referenceNow, lastLogDate);

            // If I did it today (0) or yesterday (1), streak is alive.
            // If gap is bigger, check if gap was 'safe' (not due).
            const isAlive = diffFromNow <= 1 || (diffFromNow > 1 && this.isGapSafe(referenceNow, diffFromNow, routine));

            if (isAlive) {
                // Calculate streak backwards from last log
                let streak = 1;
                for (let i = 0; i < uniqueLogs.length - 1; i++) {
                    const recent = new Date(uniqueLogs[i].date);
                    const older = new Date(uniqueLogs[i + 1].date);
                    const diff = DateManager.getDiffDays(recent, older);

                    if (diff === 1 || (diff > 1 && this.isGapSafe(recent, diff, routine))) {
                        streak++;
                    } else {
                        break;
                    }
                }
                currentStreak = streak;
            }
        }

        return { current: currentStreak, longest: longestStreak };
    }

    private async calculateFrequencyStreaks(routine: IRoutineTemplate, logs: any[], referenceNow: Date): Promise<{ current: number, longest: number }> {
        if (!routine.schedule.frequencyCount) return { current: 0, longest: 0 };
        const target = routine.schedule.frequencyCount;
        const period = routine.schedule.frequencyPeriod || 'week';

        const { startOfWeek, startOfMonth, format, subWeeks, subMonths } = await import('date-fns');

        // Helper to get period key (standardized)
        const getPeriodKey = (d: Date) => {
            const date = new Date(d);
            if (period === 'month') {
                return format(startOfMonth(date), 'yyyy-MM');
            } else {
                return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-\'W\'ww'); // ISO-like week
            }
        };

        const periodCounts = new Map<string, number>();
        logs.forEach(l => {
            const key = getPeriodKey(new Date(l.date));
            periodCounts.set(key, (periodCounts.get(key) || 0) + 1);
        });

        // Determine "Success" periods
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        let isStreakAlive = true;

        // Check last 52 periods
        const checkDate = new Date(referenceNow);

        for (let i = 0; i < 52; i++) {
            const key = getPeriodKey(checkDate);
            const count = periodCounts.get(key) || 0;

            if (count >= target) {
                tempStreak++;
                if (isStreakAlive) currentStreak++;
            } else {
                // Exception: Current period is allowed to be incomplete if we are strictly calculating PAST streaks?
                // No, "Frequency" streak implies you are maintaining the volume.
                // If this is the CURRENT week, and I haven't finished, the streak isn't "broken" yet, but it's not "incremented" either?
                // It's ambiguous. Logic: Do NOT break streak on current week if Incomplete.
                if (i === 0) {
                    // Current week incomplete. Do not increment streak, do not break flag.
                } else {
                    isStreakAlive = false;
                    longestStreak = Math.max(longestStreak, tempStreak);
                    tempStreak = 0;
                }
            }

            // Move back 1 period
            if (period === 'month') checkDate.setTime(subMonths(checkDate, 1).getTime());
            else checkDate.setTime(subWeeks(checkDate, 1).getTime());
        }

        return { current: currentStreak, longest: Math.max(longestStreak, tempStreak, currentStreak) };
    }

    private isGapSafe(startDate: Date, gapInDays: number, routine: IRoutineTemplate): boolean {
        if (routine.schedule.type === 'interval') {
            const interval = (routine.schedule.intervalValue || 1) *
                (routine.schedule.intervalUnit === 'week' ? 7 :
                    routine.schedule.intervalUnit === 'month' ? 30 : 1);

            return gapInDays <= interval;
        }

        const dateCursor = new Date(startDate);
        for (let i = 1; i < gapInDays; i++) {
            dateCursor.setDate(dateCursor.getDate() - 1);
            if (this.isRoutineDueStrict(routine, dateCursor)) {
                return false;
            }
        }
        return true;
    }

    // Check if a routine was specifically scheduled for this day (ignoring completion)
    private isRoutineDueStrict(routine: IRoutineTemplate, date: Date): boolean {
        const schedule = routine.schedule;
        if (schedule.type === 'specific_days') {
            if (schedule.days && schedule.days.length > 0) {
                return schedule.days.includes(date.getDay());
            }
            if (schedule.dates && schedule.dates.length > 0) {
                return schedule.dates.includes(date.getDate());
            }
        }

        // Interval routines are NOT due on specific days; they are due based on the last completion date.
        // The isGapSafe method handles interval-based 'safe' gaps instead.
        return false;
    }

    // Delete all user data (Cascade Delete)
    async deleteUserData(userId: string): Promise<{ templates: number; logs: number; preferences: number }> {
        const [templates, logs, prefs] = await Promise.all([
            RoutineTemplate.deleteMany({ userId }),
            RoutineLog.deleteMany({ userId }),
            UserRoutinePreferences.deleteMany({ userId })
        ]);

        logger.info(`Deleted routine items for user ${userId}: ${templates.deletedCount} templates, ${logs.deletedCount} logs`);

        return {
            templates: templates.deletedCount || 0,
            logs: logs.deletedCount || 0,
            preferences: prefs.deletedCount || 0
        };
    }

}

export const routineService = new RoutineService();
export default routineService;
