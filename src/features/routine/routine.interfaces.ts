import { Types } from 'mongoose';
import {
    RoutineType,
    RoutineStatus,
    CompletionMode,
    IRoutineConfig,
    IRoutineSchedule,
} from '../../shared/types';

// ============================================
// REQUEST PARAMS
// ============================================

export interface CreateRoutineTemplateParams {
    name: string;
    description?: string;
    icon?: string;
    type: RoutineType;
    config: IRoutineConfig;
    schedule: IRoutineSchedule;
    completionMode?: CompletionMode;
    gradualThreshold?: number;
    linkedTags?: string[];
    order?: number;
}

export interface UpdateRoutineTemplateParams {
    name?: string;
    description?: string;
    icon?: string;
    type?: RoutineType;
    config?: IRoutineConfig;
    schedule?: IRoutineSchedule;
    completionMode?: CompletionMode;
    gradualThreshold?: number;
    linkedTags?: string[];
    order?: number;
}

export interface CreateRoutineLogParams {
    routineId: string;
    date: string | Date;
    data: {
        completed?: boolean;
        checkedItems?: boolean[];
        value?: number;
        text?: string;
    };
    journalEntryId?: string;
}

export interface UpdateRoutineLogParams {
    data?: {
        completed?: boolean;
        checkedItems?: boolean[];
        value?: number;
        text?: string;
    };
    journalEntryId?: string;
}

export interface GetRoutineLogsQuery {
    date?: string;
    startDate?: string;
    endDate?: string;
    routineId?: string;
    timezoneOffset?: number;
}

export interface GetRoutineStatsQuery {
    period?: 'week' | 'month' | 'year' | 'all';
    startDate?: string;
    endDate?: string;
}

export interface GetRoutineAnalyticsQuery {
    period?: 'week' | 'month' | 'year';
}

export interface UpdateUserRoutinePreferencesParams {
    reminders?: {
        enabled?: boolean;
        dailyReminderTime?: string;
        smartReminders?: boolean;
        customReminders?: Array<{
            routineId: string;
            time: string;
            message?: string;
        }>;
    };
    defaultView?: 'list' | 'grid' | 'compact';
    showStreaksOnCalendar?: boolean;
}

export interface ReorderRoutinesParams {
    routineIds: string[];
}

// ============================================
// SERVICE RETURN TYPES
// ============================================

export interface StreakCalculationResult {
    currentStreak: number;
    longestStreak: number;
}

export interface CompletionCalculationResult {
    completionPercentage: number;
    countsForStreak: boolean;
}
