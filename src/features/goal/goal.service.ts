import { Types } from 'mongoose';
import Goal from './goal.model';
import { CreateGoalParams, UpdateGoalParams, UpdateGoalProgressParams, GetGoalsQuery } from './goal.interfaces';
import { GOAL_STATUS } from '../../shared/constants';
import { IGoal, RoutineType } from '../../shared/types';

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
            // Apply updates logic
            let increment = 0;

            // Match types
            if (goal.type === 'counter' || goal.type === 'duration') {
                // If routine is same type, just add
                if (routineType === goal.type) {
                    increment = Number(delta) || 0;
                }
                // If routine is boolean (completion), add 1
                else if (routineType === 'boolean') {
                    // delta for boolean is 1 (completed) or -1 (uncompleted)
                    increment = Number(delta) || 0;
                }
            }
            // For boolean goals, check if routine completion matters
            // Usually boolean goals are "Do X once". 
            // If linked routine completed, mark goal completed?
            // Let's stick to numeric accumulation for now as it's safer.

            if (increment !== 0) {
                goal.progress.currentValue = (goal.progress.currentValue || 0) + increment;
                goal.progress.lastUpdate = new Date();
                await goal.save();
            }
        }
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
