import { Types } from 'mongoose';
import { BaseEntity } from '../../shared/types';
import { DataConfig, DataType, DataValue } from '../../shared/types/dataProperties';

// Routine Types
export type RoutineType = DataType;
export type RoutineStatus = 'active' | 'paused' | 'archived';
export type CompletionMode = 'strict' | 'gradual';

// Routine Configuration (type-specific)
export type IRoutineConfig = DataConfig;

// Routine Schedule
export interface IRoutineSchedule {
    activeDays: number[]; // 0-6 (Sunday-Saturday)
}

// Routine Streak Data
export interface IRoutineStreakData {
    currentStreak: number;
    longestStreak: number;
    totalCompletions: number;
    lastCompletedDate?: Date;
}

// Routine Template
export interface IRoutineTemplate extends BaseEntity {
    userId: Types.ObjectId;
    name: string;
    description?: string;
    icon?: string;
    type: RoutineType;
    config: IRoutineConfig;
    schedule: IRoutineSchedule;
    completionMode: CompletionMode;
    gradualThreshold?: number;
    streakData: IRoutineStreakData;
    status: RoutineStatus;
    linkedTags?: Types.ObjectId[];
    order: number;
    archivedAt?: Date;
}

// Routine Log Data (type-specific)
export interface IRoutineLogData {
    value: DataValue;
    // Metadata about the completion ?
    notes?: string;
}

// Routine Log
export interface IRoutineLog extends BaseEntity {
    userId: Types.ObjectId;
    routineId: Types.ObjectId;
    date: Date; // Normalized to start of day
    data: IRoutineLogData;
    completionPercentage: number;
    countsForStreak: boolean;
    journalEntryId?: Types.ObjectId;
    loggedAt: Date;
    configSnapshot?: IRoutineConfig;
}

// User Routine Preferences
export interface IUserRoutinePreferences extends BaseEntity {
    userId: Types.ObjectId;
    reminders: {
        enabled: boolean;
        dailyReminderTime?: string;
        smartReminders: boolean;
        customReminders?: Array<{
            routineId: Types.ObjectId;
            time: string;
            message?: string;
        }>;
    };
    defaultView: 'list' | 'grid' | 'compact';
    showStreaksOnCalendar: boolean;
}

// Routine Statistics
export interface IRoutineStats {
    completionRate: number;
    currentStreak: number;
    longestStreak: number;
    totalCompletions: number;
    recentLogs: IRoutineLog[];
    weeklyTrend: number[];
}

// Overall Routine Analytics
export interface IRoutineAnalytics {
    overallCompletionRate: number;
    totalActiveRoutines: number;
    routineBreakdown: Array<{
        routine: IRoutineTemplate;
        completionRate: number;
        streak: number;
    }>;
}

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
        value: DataValue;
        notes?: string;
    };
    journalEntryId?: string;
}

export interface UpdateRoutineLogParams {
    data?: {
        value?: DataValue;
        notes?: string;
    };
    journalEntryId?: string;
}

export interface GetRoutineLogsQuery {
    date?: string;
    startDate?: string;
    endDate?: string;
    routineId?: string;
    routineIds?: string[];
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
