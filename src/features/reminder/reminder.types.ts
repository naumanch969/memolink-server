import { Document, Types } from 'mongoose';

// ENUMS & CONSTANTS
export enum ReminderStatus {
    PENDING = 'pending',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
}

export enum ReminderType {
    EVENT = 'event', // A one-off task with a hard deadline
    NUDGE = 'nudge', // A recurring behavior or gentler push
}


export enum RecurrenceFrequency {
    DAILY = 'daily',
    WEEKLY = 'weekly',
    MONTHLY = 'monthly',
    YEARLY = 'yearly',
    CUSTOM = 'custom',
}

export enum NotificationTimeType {
    MINUTES = 'minutes',
    HOURS = 'hours',
    DAYS = 'days',
}


export interface IRecurrence {
    enabled: boolean;
    frequency: RecurrenceFrequency;
    interval?: number; // e.g., every 2 weeks
    daysOfWeek?: number[]; // 0-6 for weekly recurrence (0 = Sunday)
    endDate?: Date;
    endAfterOccurrences?: number;
}

export interface INotificationTime {
    type: NotificationTimeType;
    value: number; // e.g., 10 minutes, 1 hour, 1 day
}

export interface INotificationSettings {
    enabled: boolean;
    times: INotificationTime[];
}

export interface IReminder {
    userId: Types.ObjectId;

    // Basic Info
    title: string;
    description?: string;
    type: ReminderType; // EVENT or NUDGE

    // Scheduling
    date: Date; // The main date of the reminder
    startTime?: string; // HH:mm format (optional)
    endTime?: string; // HH:mm format (optional)
    allDay: boolean; // true if no specific time

    // Recurrence
    recurring: IRecurrence;
    parentReminderId?: Types.ObjectId; // If this is an instance of a recurring reminder

    // Notifications
    notifications: INotificationSettings;

    status: ReminderStatus;
    completedAt?: Date;

    // Integrations
    linkedGoalId?: Types.ObjectId;
    linkedTags?: Types.ObjectId[];
    linkedEntities?: Types.ObjectId[];
    linkedEntries?: Types.ObjectId[];


    // Metadata
    createdAt: Date;
    updatedAt: Date;
    metadata?: Record<string, any>;
}

export interface IReminderDocument extends IReminder, Document {
    _id: Types.ObjectId;
}


// REQUEST TYPES

export interface CreateReminderRequest {
    title: string;
    description?: string;
    type?: ReminderType;
    date: string; // ISO date string
    startTime?: string; // HH:mm
    endTime?: string; // HH:mm
    allDay?: boolean;
    recurring?: Partial<IRecurrence>;
    notifications?: Partial<INotificationSettings>;
    linkedGoalId?: string;
    linkedTags?: string[];
    linkedEntities?: string[];
    linkedEntries?: string[];
    metadata?: Record<string, any>;
}

export interface UpdateReminderRequest {
    title?: string;
    description?: string;
    type?: ReminderType;
    date?: string;
    startTime?: string;
    endTime?: string;
    allDay?: boolean;
    recurring?: Partial<IRecurrence>;
    notifications?: Partial<INotificationSettings>;
    status?: ReminderStatus;
    linkedGoalId?: string;
    linkedTags?: string[];
    linkedEntities?: string[];
    linkedEntries?: string[];

}

export interface GetRemindersQuery {
    startDate?: string; // ISO date
    endDate?: string; // ISO date
    type?: ReminderType | ReminderType[];
    status?: ReminderStatus | ReminderStatus[];
    tagId?: string;
    entityId?: string;
    entryId?: string;

    limit?: number;
    skip?: number;
    q?: string;
}

export interface CompleteReminderRequest {
    completedAt?: string; // ISO date string
}

// RESPONSE TYPES

export interface ReminderResponse {
    _id: string;
    userId: string;
    title: string;
    description?: string;
    type: ReminderType;
    date: string;
    startTime?: string;
    endTime?: string;
    allDay: boolean;
    recurring: IRecurrence;
    parentReminderId?: string;
    notifications: INotificationSettings;
    status: ReminderStatus;
    completedAt?: string;
    linkedGoalId?: string;
    linkedTags?: any[]; // Can be populated
    linkedEntities?: any[];
    linkedEntries?: any[];

    createdAt: string;
    updatedAt: string;
    nextOccurrence?: ReminderResponse;
}

export interface GetRemindersResponse {
    reminders: ReminderResponse[];
    total: number;
    page: number;
    limit: number;
}

export interface IReminderService {
    createReminder(userId: string | Types.ObjectId, data: CreateReminderRequest): Promise<ReminderResponse>;
    getReminders(userId: string | Types.ObjectId, query: GetRemindersQuery): Promise<GetRemindersResponse>;
    getReminderById(userId: string | Types.ObjectId, reminderId: string): Promise<ReminderResponse>;
    getUpcomingReminders(userId: string | Types.ObjectId, limit?: number): Promise<ReminderResponse[]>;
    getOverdueReminders(userId: string | Types.ObjectId): Promise<ReminderResponse[]>;
    updateReminder(userId: string | Types.ObjectId, reminderId: string, data: UpdateReminderRequest): Promise<ReminderResponse>;
    completeReminder(userId: string | Types.ObjectId, reminderId: string, completedAt?: Date): Promise<ReminderResponse>;
    cancelReminder(userId: string | Types.ObjectId, reminderId: string): Promise<ReminderResponse>;
    deleteReminder(userId: string | Types.ObjectId, reminderId: string): Promise<void>;
    deleteUserData(userId: string | Types.ObjectId): Promise<number>;
}

