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
}
