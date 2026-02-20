import { addDays, addYears } from 'date-fns';
import { Types } from 'mongoose';
import logger from '../../config/logger';
import { ApiError } from '../../core/errors/api.error';
import { GOAL_STATUS } from '../../shared/constants';
import { EdgeType, NodeType } from '../graph/edge.model';
import graphService from '../graph/graph.service';
import reminderService from '../reminder/reminder.service';
import { RecurrenceFrequency } from '../reminder/reminder.types';
import { CreateGoalParams, GetGoalsQuery, GoalPeriod, IGoal, UpdateGoalParams, UpdateGoalProgressParams } from './goal.interfaces';
import Goal from './goal.model';

export class GoalService {

    async createGoal(userId: string, params: CreateGoalParams): Promise<IGoal> {
        try {
            // 1. Enforce Deadline based on Period
            const startDate = params.startDate ? new Date(params.startDate) : new Date();
            let deadline = params.deadline ? new Date(params.deadline) : undefined;

            if (!deadline && params.period && params.period !== GoalPeriod.INDEFINITE) {
                deadline = this._calculateDeadline(startDate, params.period);
            }

            const goal = await Goal.create({
                userId: new Types.ObjectId(userId),
                ...params,
                deadline, // Set calculated deadline
                startDate,
                // Ensure specific fields are correctly parsed or set
                tags: params.tags?.map(id => new Types.ObjectId(id)),
                metadata: params.metadata,
            });

            // 2. Auto-Create Reminders
            await this._manageReminders(userId, goal);

            // Create Graph Association
            await graphService.createAssociation({
                fromId: userId,
                fromType: NodeType.USER,
                toId: goal._id.toString(),
                toType: NodeType.GOAL,
                relation: EdgeType.HAS_GOAL,
                metadata: { title: goal.title }
            }).catch(err => logger.error(`[GoalService] Graph association failed`, err));

            // Re-fetch to get updated progress
            return (await Goal.findById(goal._id).lean()) as IGoal;
        } catch (error: any) {
            if (error.code === 11000) {
                throw ApiError.conflict('An active goal with this title already exists.');
            }
            throw error;
        }
    }

    async getGoals(userId: string, query: GetGoalsQuery): Promise<IGoal[]> {
        const filter: any = { userId: new Types.ObjectId(userId) };

        if (query.status && query.status !== 'all') {
            filter.status = query.status;
        } else if (!query.status) {
            // Default: show active
            filter.status = { $ne: GOAL_STATUS.ARCHIVED };
        }



        if (query.period) {
            filter.period = query.period;
        }

        if (query.priority) {
            filter.priority = query.priority;
        }

        if (query.hasDeadline === true) {
            filter.deadline = { $exists: true, $ne: null };
        } else if (query.hasDeadline === false) {
            filter.deadline = { $exists: false };
        }

        const goals = await Goal.find(filter)
            .sort({ priority: -1, deadline: 1, createdAt: -1 })
            .lean();

        return goals as IGoal[];
    }

    async getGoalById(userId: string, goalId: string): Promise<IGoal | null> {
        const goal = await Goal.findOne({
            _id: new Types.ObjectId(goalId),
            userId: new Types.ObjectId(userId),
        }).lean();
        return goal as IGoal | null;
    }

    async updateGoal(userId: string, goalId: string, params: UpdateGoalParams): Promise<IGoal | null> {
        const updateData: any = { ...params };

        if (params.tags) {
            updateData.tags = params.tags.map(id => new Types.ObjectId(id));
        }

        const goal = await Goal.findOneAndUpdate(
            {
                _id: new Types.ObjectId(goalId),
                userId: new Types.ObjectId(userId)
            },
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (goal) {
            // If period or schedule changed, update reminders
            if (params.period || params.trackingSchedule) {
                const updatedGoalDoc = await Goal.findById(goal._id);
                if (updatedGoalDoc) {
                    await this._manageReminders(userId, updatedGoalDoc);
                }
            }

        }

        return goal ? goal.toObject() : null;
    }

    async updateProgress(userId: string, goalId: string, params: UpdateGoalProgressParams): Promise<IGoal | null> {
        const goal = await Goal.findOne({
            _id: new Types.ObjectId(goalId),
            userId: new Types.ObjectId(userId)
        });

        if (!goal) return null;

        // ── 1. Update currentValue ─────────────────────────────────
        if (params.value !== undefined) {
            if (params.mode === 'add' && typeof params.value === 'number') {
                const current = (goal.progress.currentValue as number) || 0;
                goal.progress.currentValue = current + params.value;
            } else if (typeof params.value === 'number') {
                goal.progress.currentValue = params.value;
            }
        }

        if (params.notes) {
            goal.progress.notes = params.notes;
        }

        // ── 2. Record dated progress log (one per calendar day) ────
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const logValue = typeof params.value === 'number' ? params.value : 1;

        const existingTodayIdx = goal.progressLogs.findIndex(
            l => new Date(l.date).toDateString() === today.toDateString()
        );

        if (existingTodayIdx >= 0) {
            // Accumulate within the same day
            if (params.mode === 'add') {
                goal.progressLogs[existingTodayIdx].value += logValue;
            } else {
                goal.progressLogs[existingTodayIdx].value = logValue;
            }
        } else {
            goal.progressLogs.push({ date: today, value: logValue });
            goal.progress.totalCompletions = (goal.progress.totalCompletions ?? 0) + 1;
        }

        // ── 3. Recompute current streak ────────────────────────────
        // Sort logs descending
        const sortedLogs = [...goal.progressLogs].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        let streak = 0;
        const cursor = new Date(today);

        for (const log of sortedLogs) {
            const logDay = new Date(log.date);
            logDay.setHours(0, 0, 0, 0);
            if (logDay.toDateString() === cursor.toDateString()) {
                streak++;
                cursor.setDate(cursor.getDate() - 1);
            } else if (logDay < cursor) {
                break; // Gap found — streak is broken
            }
        }

        goal.progress.streakCurrent = streak;
        goal.progress.streakLongest = Math.max(
            goal.progress.streakLongest ?? 0,
            streak
        );
        goal.progress.lastLogDate = today;
        goal.progress.lastUpdate = new Date();

        await goal.save();
        return goal.toObject();
    }

    async deleteGoal(userId: string, goalId: string): Promise<boolean> {
        const result = await Goal.deleteOne({
            _id: new Types.ObjectId(goalId),
            userId: new Types.ObjectId(userId),
        });

        if (result.deletedCount === 1) {
            const { graphService } = await import('../graph/graph.service');
            await graphService.removeNodeEdges(goalId).catch(err => logger.error(`[GoalService] Failed to cleanup graph edges`, err));
        }

        return result.deletedCount === 1;
    }

    // Delete all user data (Cascade Delete)
    async deleteUserData(userId: string): Promise<number> {
        const result = await Goal.deleteMany({ userId });
        logger.info(`Deleted ${result.deletedCount} goals for user ${userId}`);
        return result.deletedCount || 0;
    }

    // ==========================================
    // PRIVATE HELPERS
    // ==========================================

    private _calculateDeadline(startDate: Date, period: GoalPeriod): Date {
        switch (period) {
            case GoalPeriod.WEEKLY:
                return addDays(startDate, 7);
            case GoalPeriod.MONTHLY:
                return addDays(startDate, 30); // Or addMonths(startDate, 1)? User said 30 days. Let's use 30 as hardcoded request.
            // Re-reading: "only allowing 7 day goal, 30 day goal and yearly goal"
            case GoalPeriod.YEARLY:
                return addDays(startDate, 365); // User said yearly.
            default:
                return addYears(startDate, 1);
        }
    }

    private async _manageReminders(userId: string, goal: any) {
        // 1. Delete existing linked reminders
        const Reminder = (await import('../reminder/reminder.model')).Reminder;
        await Reminder.deleteMany({ linkedGoalId: goal._id });

        if (goal.status === GOAL_STATUS.ARCHIVED || goal.status === GOAL_STATUS.COMPLETED || goal.status === GOAL_STATUS.FAILED) {
            return;
        }

        // 2. Define Reminder Config based on Period
        let recurrence: any = { enabled: false };
        const title = `Goal Check-in: ${goal.title}`;

        switch (goal.period) {
            case GoalPeriod.WEEKLY:
                // Daily reminders for 7 days
                recurrence = {
                    enabled: true,
                    frequency: RecurrenceFrequency.DAILY,
                    interval: 1,
                    endDate: goal.deadline
                };
                break;

            case GoalPeriod.MONTHLY:
                // Twice a week (Mon, Thu)
                recurrence = {
                    enabled: true,
                    frequency: RecurrenceFrequency.WEEKLY,
                    daysOfWeek: [1, 4], // Mon, Thu
                    endDate: goal.deadline
                };
                break;

            case GoalPeriod.YEARLY:
                // Weekly (Sunday)
                recurrence = {
                    enabled: true,
                    frequency: RecurrenceFrequency.WEEKLY,
                    daysOfWeek: [0], // Sun
                    endDate: goal.deadline
                };
                break;

            case GoalPeriod.INDEFINITE:
                // Based on trackingSchedule
                if (goal.trackingSchedule) {
                    const ts = goal.trackingSchedule;
                    if (ts.frequency === 'daily') {
                        recurrence = { enabled: true, frequency: RecurrenceFrequency.DAILY, interval: 1 };
                    } else if (ts.frequency === 'weekdays') {
                        recurrence = { enabled: true, frequency: RecurrenceFrequency.WEEKLY, daysOfWeek: [1, 2, 3, 4, 5] };
                    } else if (ts.frequency === 'specific_days' && ts.specificDays) {
                        recurrence = { enabled: true, frequency: RecurrenceFrequency.WEEKLY, daysOfWeek: ts.specificDays };
                    } else if (ts.frequency === 'interval' && ts.intervalValue) {
                        recurrence = { enabled: true, frequency: RecurrenceFrequency.DAILY, interval: ts.intervalValue };
                    }
                }
                break;
        }

        if (recurrence.enabled) {
            await reminderService.createReminder(userId, {
                title,
                date: new Date().toISOString(), // Start today
                allDay: true,
                recurring: recurrence,
                linkedGoalId: goal._id.toString()
            });
        }
    }
}

export const goalService = new GoalService();
export default goalService;
