import { Types } from 'mongoose';
import { GOAL_STATUS } from '../../shared/constants';
import { IGoal } from './goal.interfaces';
import { RoutineType } from '../routine/routine.interfaces';
import { CreateGoalParams, GetGoalsQuery, UpdateGoalParams, UpdateGoalProgressParams } from './goal.interfaces';
import Goal from './goal.model';

export class GoalService {

    async createGoal(userId: string, params: CreateGoalParams): Promise<IGoal> {
        const goal = await Goal.create({
            userId: new Types.ObjectId(userId),
            ...params,
            // Ensure specific fields are correctly parsed or set
            linkedRoutines: params.linkedRoutines?.map(id => new Types.ObjectId(id)),
            tags: params.tags?.map(id => new Types.ObjectId(id)),
        });

        // Handle retroactive syncing
        if (params.retroactiveRoutines && params.retroactiveRoutines.length > 0) {
            await this.syncRetroactiveRoutines(userId, goal._id.toString(), params.retroactiveRoutines);
        }

        // Re-fetch to get updated progress
        return (await Goal.findById(goal._id).lean()) as IGoal;
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

        if (goal && params.retroactiveRoutines && params.retroactiveRoutines.length > 0) {
            await this.syncRetroactiveRoutines(userId, goal._id.toString(), params.retroactiveRoutines);
            return (await Goal.findById(goal._id).lean()) as IGoal;
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
            } else {
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
        delta: number | any
    ): Promise<void> {
        // Find linked goals
        const goals = await Goal.find({
            userId: new Types.ObjectId(userId),
            linkedRoutines: new Types.ObjectId(routineId),
            status: GOAL_STATUS.ACTIVE // Only update active goals
        });

        for (const goal of goals) {
            // We treat delta as a numeric contribution to the goal
            // This allows cross-type linking (e.g. checklist routine -> counter goal)
            const increment = Number(delta) || 0;

            if (increment !== 0) {
                // Update goal progress
                // We strictly update the currentValue for all types.
                const current = (goal.progress.currentValue as number) || 0;
                goal.progress.currentValue = current + increment;
                goal.progress.lastUpdate = new Date();

                await goal.save();
            }
        }
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

        return result.deletedCount === 1;
    }
}

export const goalService = new GoalService();
