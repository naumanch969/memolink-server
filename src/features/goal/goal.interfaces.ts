import { Types } from 'mongoose';
import { CreateGoalParams, GetGoalsQuery, IGoal, UpdateGoalParams, UpdateGoalProgressParams } from "./goal.types";

// Goal Types

export interface IGoalService {
    createGoal(userId: string | Types.ObjectId, params: CreateGoalParams): Promise<IGoal>;
    getGoals(userId: string, query: GetGoalsQuery): Promise<IGoal[]>;
    getGoalById(userId: string, goalId: string): Promise<IGoal | null>;
    updateGoal(userId: string, goalId: string, params: UpdateGoalParams): Promise<IGoal | null>;
    updateProgress(userId: string, goalId: string, params: UpdateGoalProgressParams): Promise<IGoal | null>;
    deleteGoal(userId: string, goalId: string): Promise<boolean>;
    deleteUserData(userId: string): Promise<number>;
}

export interface IGoalReminderService {
    manageReminders(userId: string | Types.ObjectId, goal: any): Promise<void>;
}

export interface IGoalProgressService {
    updateProgress(userId: string, goalId: string, params: UpdateGoalProgressParams): Promise<IGoal | null>;
}


