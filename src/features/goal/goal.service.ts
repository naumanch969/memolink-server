import { addDays, addYears } from 'date-fns';
import { ClientSession, Types } from 'mongoose';
import logger from '../../config/logger';
import { ApiError } from '../../core/errors/api.error';
import { GOAL_STATUS } from '../../shared/constants';
import { EdgeType, NodeType } from '../graph/edge.model';
import graphService from '../graph/graph.service';
import reminderService from '../reminder/reminder.service';
import { RecurrenceFrequency, ReminderPriority } from '../reminder/reminder.types';
import { RoutineType } from '../routine/routine.interfaces';
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
                linkedRoutines: params.linkedRoutines?.map(id => new Types.ObjectId(id)),
                tags: params.tags?.map(id => new Types.ObjectId(id)),
                metadata: params.metadata,
            });

            // 2. Auto-Create Reminders
            await this._manageReminders(userId, goal);

            // Handle retroactive syncing
            if (params.retroactiveRoutines && params.retroactiveRoutines.length > 0) {
                await this.syncRetroactiveRoutines(userId, goal._id.toString(), params.retroactiveRoutines);
            }

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

        if (query.type) {
            filter.type = query.type;
        }

        if (query.priority) {
            filter.priority = query.priority;
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

        if (params.linkedRoutines) {
            updateData.linkedRoutines = params.linkedRoutines.map(id => new Types.ObjectId(id));
        }
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

            if (params.retroactiveRoutines && params.retroactiveRoutines.length > 0) {
                await this.syncRetroactiveRoutines(userId, goal._id.toString(), params.retroactiveRoutines);
                return (await Goal.findById(goal._id).lean()) as IGoal;
            }
        }

        return goal ? goal.toObject() : null;
    }

    // Helper to calculate total progress from past logs of specified routines
    private async syncRetroactiveRoutines(userId: string, goalId: string, routineIds: string[]) {
        const { RoutineLog } = await import('../routine/routine.model'); // Dynamic import to avoid circular dependency if any

        const goal = await Goal.findById(goalId);
        if (!goal) return;

        let totalIncrement = 0;

        for (const routineId of routineIds) {
            // Fetch all logs for this routine
            const logs = await RoutineLog.find({
                userId: new Types.ObjectId(userId),
                routineId: new Types.ObjectId(routineId),

            });

            // Calculate contribution based on goal type logic (simplified)
            // Ideally should match the logic in updateProgressFromRoutineLog but aggregated
            for (const log of logs) {
                // If log counts for streak or has progress
                // Simple logic: add log value if present, else 1 if completed
                if (log.data.value !== undefined && log.data.value !== null) {
                    // For numeric values, add them
                    if (typeof log.data.value === 'number') {
                        totalIncrement += log.data.value;
                    }
                    // For boolean true, count as 1
                    else if (log.data.value === true) {
                        totalIncrement += 1;
                    }
                    // For checklist, count checked items
                    else if (Array.isArray(log.data.value)) {
                        totalIncrement += log.data.value.filter(Boolean).length;
                    }
                } else if (log.countsForStreak) {
                    totalIncrement += 1;
                }
            }
        }

        if (totalIncrement > 0) {
            const current = typeof goal.progress.currentValue === 'number' ? goal.progress.currentValue : 0;
            goal.progress.currentValue = current + totalIncrement;
            goal.progress.lastUpdate = new Date();
            await goal.save();
        }
    }

    async updateProgress(
        userId: string,
        goalId: string,
        params: UpdateGoalProgressParams
    ): Promise<IGoal | null> {
        const goal = await Goal.findOne({
            _id: new Types.ObjectId(goalId),
            userId: new Types.ObjectId(userId)
        });

        if (!goal) return null;

        // Logic for updating progress based on type
        if (params.value !== undefined) {
            // Here, we have to assume a bit about the structure if it's 'add'
            // For now, simpler to just set the value if it's generic DataValue
            // But if we want to "add", we need to know it's a number
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

        goal.progress.lastUpdate = new Date();

        await goal.save();
        return goal.toObject();
    }

    // New method for routine integration
    async updateProgressFromRoutineLog(
        userId: string,
        routineId: string,
        routineType: RoutineType,
        delta: number | any,
        linkedGoalIds: string[] = [],
        session?: ClientSession
    ): Promise<void> {
        const goalIds = linkedGoalIds.map(id => new Types.ObjectId(id));
        const increment = Number(delta) || 0;

        if (increment === 0) return;

        // Atomic update to all linked goals using MongoDB $inc
        await Goal.updateMany(
            {
                userId: new Types.ObjectId(userId),
                status: GOAL_STATUS.ACTIVE,
                $or: [
                    { linkedRoutines: new Types.ObjectId(routineId) },
                    { _id: { $in: goalIds } }
                ]
            },
            {
                $inc: { 'progress.currentValue': increment },
                $set: { 'progress.lastUpdate': new Date() }
            },
            { session }
        );
    }

    async removeLinkedRoutine(routineId: string): Promise<void> {
        await Goal.updateMany(
            { linkedRoutines: new Types.ObjectId(routineId) },
            { $pull: { linkedRoutines: new Types.ObjectId(routineId) } }
        );
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
                priority: ReminderPriority.HIGH,
                linkedGoalId: goal._id.toString()
            });
        }
    }
}

export const goalService = new GoalService();
export default goalService;
