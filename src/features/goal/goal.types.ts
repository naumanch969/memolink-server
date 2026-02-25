import { Types } from "mongoose";
import { BaseEntity, DataValue } from "../../shared/types";

export interface IGoalTrackingSchedule {
    frequency: 'daily' | 'weekdays' | 'specific_days' | 'interval';
    specificDays?: number[];
    intervalValue?: number;
    timesPerPeriod?: number;
}

export interface IGoalTrackingConfig {
    type: GoalTrackingType;
    targetValue?: number;
    targetItems?: string[];
    unit?: string;
}

export interface IGoalProgressLog {
    date: Date;
    value: number;
}

export interface IGoalProgress {
    currentValue?: number;
    completedItems?: string[];
    streakCurrent?: number;
    streakLongest?: number;
    totalCompletions?: number;
    lastLogDate?: Date;
    notes?: string;
    lastUpdate?: Date;
}

export interface IGoalMilestone {
    _id?: Types.ObjectId;
    title: string;
    targetValue?: number;
    deadline?: Date;
    completed: boolean;
    completedAt?: Date;
}

export interface IGoal extends BaseEntity {
    userId: Types.ObjectId;
    title: string;
    description?: string;
    why?: string;
    icon?: string;
    color?: string;
    parentId?: Types.ObjectId;
    period: GoalPeriod;
    trackingSchedule?: IGoalTrackingSchedule;
    trackingConfig?: IGoalTrackingConfig;
    status: GoalStatus;
    progress: IGoalProgress;
    progressLogs: IGoalProgressLog[];
    startDate: Date;
    deadline?: Date;
    completedAt?: Date;
    milestones?: IGoalMilestone[];
    priority: 'low' | 'medium' | 'high';
    tags?: Types.ObjectId[];
    reward?: string;
    metadata?: Record<string, any>;
}

export interface CreateGoalParams {
    title: string;
    description?: string;
    why?: string;
    icon?: string;
    color?: string;
    status?: GoalStatus;
    parentId?: string;
    period?: GoalPeriod;
    trackingSchedule?: IGoalTrackingSchedule;
    trackingConfig?: IGoalTrackingConfig;
    startDate?: string | Date;
    deadline?: string | Date;
    priority?: 'low' | 'medium' | 'high';
    tags?: string[];
    reward?: string;
    milestones?: Array<{
            title: string;
            targetValue?: number;
            deadline?: string | Date;
        }>;
    metadata?: Record<string, any>;
}

export interface UpdateGoalParams {
    title?: string;
    description?: string;
    why?: string;
    icon?: string;
    color?: string;
    status?: GoalStatus;
    parentId?: string;
    period?: GoalPeriod;
    trackingSchedule?: IGoalTrackingSchedule;
    trackingConfig?: IGoalTrackingConfig;
    deadline?: string | Date;
    priority?: 'low' | 'medium' | 'high';
    tags?: string[];
    reward?: string;
    milestones?: Array<{
            _id?: string;
            title: string;
            targetValue?: number;
            deadline?: string | Date;
            completed?: boolean;
        }>;
}

export interface UpdateGoalProgressParams {
    value?: DataValue;
    mode?: 'add' | 'set';
    completedItems?: string[];
    notes?: string;
}

export interface GetGoalsQuery {
    status?: GoalStatus | 'all';
    period?: GoalPeriod;
    priority?: string;
    hasDeadline?: boolean;
}

export type GoalStatus = 'active' | 'completed' | 'failed' | 'archived';

export enum GoalPeriod {
    WEEKLY = 'weekly',
    MONTHLY = 'monthly',
    YEARLY = 'yearly',
    INDEFINITE = 'indefinite'
}

export enum GoalTrackingType {
    BOOLEAN = 'boolean',
    VALUE = 'value',
    CHECKLIST = 'checklist'
}
