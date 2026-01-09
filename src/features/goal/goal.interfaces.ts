import {
    GoalStatus,
    IGoalConfig,
    IGoalProgress,
    RoutineType,
} from '../../shared/types';
import { Types } from 'mongoose';

export interface CreateGoalParams {
    title: string;
    description?: string;
    why?: string;
    icon?: string;
    color?: string;
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
}

export interface UpdateGoalProgressParams {
    value?: number; // Add/Set value
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
