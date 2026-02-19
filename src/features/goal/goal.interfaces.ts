import { Types } from 'mongoose';
import { BaseEntity } from '../../shared/types';
import { DataValue } from '../../shared/types/dataProperties';
import { RoutineType } from '../routine/routine.interfaces'; // Import RoutineType

// Goal Types
export enum GoalPeriod {
    WEEKLY = 'weekly',       // 7 days
    MONTHLY = 'monthly',     // 30 days
    YEARLY = 'yearly',       // 365 days
    INDEFINITE = 'indefinite' // Perpetual / Habit
}

export enum GoalTrackingType {
    BOOLEAN = 'boolean',     // Done/Not Done
    VALUE = 'value',         // Numerical target (e.g. 10000 steps)
    CHECKLIST = 'checklist', // List of items
}

export type GoalStatus = 'active' | 'completed' | 'failed' | 'archived';

export interface IGoalTrackingSchedule {
    frequency: 'daily' | 'weekdays' | 'specific_days' | 'interval';
    specificDays?: number[]; // 0-6 (Sun-Sat)
    intervalValue?: number;  // e.g. every 3 days
    timesPerPeriod?: number; // e.g. 3 times per week
}

export interface IGoalTrackingConfig {
    type: GoalTrackingType;
    targetValue?: number;
    targetItems?: string[]; // For checklists
    unit?: string;
}

export interface IGoalProgressLog {
    date: Date;
    value: number; // 1 for boolean check-ins, numeric delta for value type
}

export interface IGoalProgress {
    currentValue?: number; // For value type
    completedItems?: string[]; // For checklist type
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
    why?: string; // Motivation
    icon?: string;
    color?: string;

    parentId?: Types.ObjectId; // Hierarchy: Year > Month > Week

    period: GoalPeriod;
    trackingSchedule?: IGoalTrackingSchedule; // For Indefinite/Habit goals
    trackingConfig?: IGoalTrackingConfig;

    type: RoutineType; // Keeping for backward compatibility or categorize as 'habit' vs 'project'
    status: GoalStatus;

    // config: IGoalConfig; // Deprecated
    progress: IGoalProgress;
    progressLogs: IGoalProgressLog[]; // Per-day completion history for calendar

    startDate: Date;
    deadline?: Date;
    completedAt?: Date;

    linkedRoutines?: Types.ObjectId[]; // Routines that contribute to this goal
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
    type: RoutineType;

    parentId?: string;
    period?: GoalPeriod;
    trackingSchedule?: IGoalTrackingSchedule;
    trackingConfig?: IGoalTrackingConfig;

    // config: IGoalConfig;

    startDate?: string | Date;
    deadline?: string | Date;

    priority?: 'low' | 'medium' | 'high';
    linkedRoutines?: string[];
    tags?: string[];
    reward?: string;

    milestones?: Array<{
        title: string;
        targetValue?: number;
        deadline?: string | Date;
    }>;
    retroactiveRoutines?: string[];
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

    // config?: IGoalConfig;

    deadline?: string | Date;

    priority?: 'low' | 'medium' | 'high';
    linkedRoutines?: string[];
    tags?: string[];
    reward?: string;

    // Milestones are usually updated via specific methods or full replace
    milestones?: Array<{
        _id?: string;
        title: string;
        targetValue?: number;
        deadline?: string | Date;
        completed?: boolean;
    }>;
    retroactiveRoutines?: string[];
}

export interface UpdateGoalProgressParams {
    value?: DataValue; // Add/Set value
    mode?: 'add' | 'set'; // For numeric counters
    completedItems?: string[]; // Check off items
    notes?: string;
}

export interface GetGoalsQuery {
    status?: GoalStatus | 'all'; // 'all' might mean everything except archived
    type?: RoutineType;
    priority?: string;
    hasDeadline?: boolean;
}
