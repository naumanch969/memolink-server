import { Types } from 'mongoose';
import { BaseEntity } from '../../shared/types';
import { DataConfig, DataValue } from '../../shared/types/dataProperties';
import { RoutineType } from '../routine/routine.interfaces'; // Import RoutineType

// Goal Types
export type GoalStatus = 'active' | 'completed' | 'failed' | 'archived';

export type IGoalConfig = DataConfig;

export interface IGoalProgress {
    currentValue?: DataValue;
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

    type: RoutineType; // reusing RoutineType which is now DataType
    status: GoalStatus;

    config: IGoalConfig;
    progress: IGoalProgress;

    startDate: Date;
    deadline?: Date;
    completedAt?: Date;

    linkedRoutines?: Types.ObjectId[]; // Routines that contribute to this goal
    milestones?: IGoalMilestone[];

    priority: 'low' | 'medium' | 'high';
    tags?: Types.ObjectId[];

    reward?: string;
}

export interface CreateGoalParams {
    title: string;
    description?: string;
    why?: string;
    icon?: string;
    color?: string;
    status?: GoalStatus;
    type: RoutineType;

    config: IGoalConfig;

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
}

export interface UpdateGoalParams {
    title?: string;
    description?: string;
    why?: string;
    icon?: string;
    color?: string;
    status?: GoalStatus;

    config?: IGoalConfig;

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
