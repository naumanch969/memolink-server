import { Types } from 'mongoose';
import { BaseEntity } from '../../shared/types';
import { DataType, DataValue } from '../../shared/types/dataProperties';

// Routine Types
export type RoutineType = DataType;
export type RoutineStatus = 'active' | 'paused' | 'archived';
export type CompletionMode = 'strict' | 'gradual';

// ============================================
// ROUTINE CONFIGURATION
// ============================================

export interface IRoutineConfig {
    // Checklist type
    items?: string[];

    // Counter/Duration type
    target?: number;
    unit?: string;

    // Scale type
    min?: number;
    max?: number;
    minLabel?: string;
    maxLabel?: string;
    step?: number;

    // Text type
    maxLength?: number;
    placeholder?: string;
    multiline?: boolean;

    // Time type
    format?: '12' | '24';
    targetTime?: string; // HH:mm format

    // Duration specific
    targetSeconds?: number;
}

// ============================================
// SCHEDULING (NEW ROBUST SYSTEM)
// ============================================

export type ScheduleType = 'specific_days' | 'frequency' | 'interval';

export interface IScheduleConfig {
    type: ScheduleType;

    // Mode A: Specific Days (e.g. Mon, Wed OR 1st, 15th)
    days?: number[]; // 0-6 (Sunday-Saturday)
    dates?: number[]; // 1-31 (Day of month)

    // Mode B: Frequency (e.g. 3 times per week)
    frequencyCount?: number;
    frequencyPeriod?: 'week' | 'month';

    // Mode C: Interval (e.g. Every 3 days)
    intervalValue?: number;
    intervalUnit?: 'day' | 'week' | 'month';
}

export interface IStreakConfig {
    allowSkips: boolean;
    maxBankedSkips: number; // Max accumulated 'skip' days
    skipCost: number; // How many banked skips to use per missed day (usually 1)
}

// Routine Streak Data
export interface IRoutineStreakData {
    currentStreak: number;
    longestStreak: number;
    totalCompletions: number;
    lastCompletedDate?: string; // ISO String
    bankedSkips: number; // Current available skips
}

// ============================================
// ROUTINE TEMPLATE
// ============================================

export interface IRoutineTemplate extends BaseEntity {
    userId: Types.ObjectId;
    name: string;
    description?: string;
    icon?: string;
    type: RoutineType;

    config: IRoutineConfig;
    schedule: IScheduleConfig; // Updated schedule engine
    streakConfig: IStreakConfig; // New streak controls

    completionMode: CompletionMode;
    gradualThreshold?: number;

    streakData: IRoutineStreakData;

    status: RoutineStatus;

    // Explicit Goal Linking
    linkedGoals?: string[]; // IDs of goals this routine contributes to
    linkedTags?: string[] | any[];

    order: number;
    archivedAt?: string;
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
// REQUEST TYPES
// ============================================

export interface CreateRoutineTemplateParams {
    name: string;
    description?: string;
    icon?: string;
    type: RoutineType;

    config: IRoutineConfig;
    schedule: IScheduleConfig;
    streakConfig?: Partial<IStreakConfig>;

    completionMode?: CompletionMode;
    gradualThreshold?: number;

    linkedGoals?: string[];
    linkedTags?: string[];
    order?: number;
}

export interface UpdateRoutineTemplateParams {
    name?: string;
    description?: string;
    icon?: string;

    config?: IRoutineConfig;
    schedule?: IScheduleConfig;
    streakConfig?: Partial<IStreakConfig>;

    completionMode?: CompletionMode;
    gradualThreshold?: number;

    linkedGoals?: string[];
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
    timezoneOffset?: number; // In minutes
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
