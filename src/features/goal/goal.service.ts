import { Types } from 'mongoose';
import { GOAL_STATUS } from '../../shared/constants';
import { IGoal, RoutineType } from '../../shared/types';
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

        return goal.toObject();
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
        ).lean();

        return goal as IGoal | null;
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
            if (params.mode === 'add') {
                goal.progress.currentValue = (goal.progress.currentValue || 0) + params.value;
            } else {
                goal.progress.currentValue = params.value;
            }
        }

        if (params.completedItems) {
            goal.progress.completedItems = params.completedItems;
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
                goal.progress.currentValue = (goal.progress.currentValue || 0) + increment;
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
