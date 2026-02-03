import { Document, Types } from 'mongoose';

export enum NotificationType {
    REMINDER = 'reminder',
    SYSTEM = 'system',
    ACHIEVEMENT = 'achievement',
    GOAL = 'goal',
    NUDGE = 'nudge'
}

export interface INotification {
    userId: Types.ObjectId;
    type: NotificationType;
    title: string;
    message: string;
    isRead: boolean;
    referenceId?: Types.ObjectId; // e.g., ReminderID, GoalID
    referenceModel?: string; // e.g., 'Reminder', 'Goal'
    actionUrl?: string; // For frontend navigation
    eventId?: string; // For idempotency (from EventStream)
    createdAt: Date;
    updatedAt: Date;
}

export interface INotificationDocument extends INotification, Document {
    _id: Types.ObjectId;
}

// DTOs
export interface CreateNotificationDTO {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    referenceId?: string;
    referenceModel?: string;
    actionUrl?: string;
    eventId?: string;
}

// ============================================
// NOTIFICATION QUEUE (Moved from Reminder)
// ============================================

export enum NotificationStatus {
    PENDING = 'pending',
    SENT = 'sent',
    FAILED = 'failed',
}

export interface INotificationQueue {
    userId: Types.ObjectId;
    reminderId: Types.ObjectId; // Keeping as reminderId for now to maintain compat
    scheduledFor: Date;
    status: NotificationStatus;
    attempts?: number;
    sentAt?: Date;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface INotificationQueueDocument extends INotificationQueue, Document {
    _id: Types.ObjectId;
}
