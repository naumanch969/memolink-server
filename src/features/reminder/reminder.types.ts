import { Document, Types } from 'mongoose';

// ============================================
// ENUMS & CONSTANTS
// ============================================

export enum ReminderPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
}

export enum ReminderStatus {
    PENDING = 'pending',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
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

// ============================================
// INTERFACES
// ============================================

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

    // Priority & Status
    priority: ReminderPriority;
    status: ReminderStatus;
    completedAt?: Date;

    // Integrations
    linkedTags?: Types.ObjectId[];
    linkedPeople?: Types.ObjectId[];
    linkedEntries?: Types.ObjectId[];
    linkedGoals?: Types.ObjectId[];

    // Metadata
    createdAt: Date;
    updatedAt: Date;
}

export interface IReminderDocument extends IReminder, Document {
    _id: Types.ObjectId;
}

// ============================================
// NOTIFICATION QUEUE
// ============================================

export enum NotificationStatus {
    PENDING = 'pending',
    SENT = 'sent',
    FAILED = 'failed',
}

export interface INotificationQueue {
    userId: Types.ObjectId;
    reminderId: Types.ObjectId;
    scheduledFor: Date; // When the notification should fire
    status: NotificationStatus;
    sentAt?: Date;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface INotificationQueueDocument extends INotificationQueue, Document {
    _id: Types.ObjectId;
}

// ============================================
// REQUEST TYPES
// ============================================

export interface CreateReminderRequest {
    title: string;
    description?: string;
    date: string; // ISO date string
    startTime?: string; // HH:mm
    endTime?: string; // HH:mm
    allDay?: boolean;
    recurring?: Partial<IRecurrence>;
    notifications?: Partial<INotificationSettings>;
    priority?: ReminderPriority;
    linkedTags?: string[];
    linkedPeople?: string[];
    linkedEntries?: string[];
    linkedGoals?: string[];
}

export interface UpdateReminderRequest {
    title?: string;
    description?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    allDay?: boolean;
    recurring?: Partial<IRecurrence>;
    notifications?: Partial<INotificationSettings>;
    priority?: ReminderPriority;
    status?: ReminderStatus;
    linkedTags?: string[];
    linkedPeople?: string[];
    linkedEntries?: string[];
    linkedGoals?: string[];
}

export interface GetRemindersQuery {
    startDate?: string; // ISO date
    endDate?: string; // ISO date
    status?: ReminderStatus | ReminderStatus[];
    priority?: ReminderPriority | ReminderPriority[];
    tagId?: string;
    personId?: string;
    entryId?: string;
    goalId?: string;
    limit?: number;
    skip?: number;
}

export interface CompleteReminderRequest {
    completedAt?: string; // ISO date string
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface ReminderResponse {
    _id: string;
    userId: string;
    title: string;
    description?: string;
    date: string;
    startTime?: string;
    endTime?: string;
    allDay: boolean;
    recurring: IRecurrence;
    parentReminderId?: string;
    notifications: INotificationSettings;
    priority: ReminderPriority;
    status: ReminderStatus;
    completedAt?: string;
    linkedTags?: any[]; // Can be populated
    linkedPeople?: any[];
    linkedEntries?: any[];
    linkedGoals?: any[];
    createdAt: string;
    updatedAt: string;
}

export interface GetRemindersResponse {
    reminders: ReminderResponse[];
    total: number;
    page: number;
    limit: number;
}
