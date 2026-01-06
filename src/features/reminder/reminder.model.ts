import mongoose, { Schema } from 'mongoose';
import { IReminderDocument, INotificationQueueDocument, ReminderPriority, ReminderStatus, RecurrenceFrequency, NotificationTimeType, NotificationStatus, } from './reminder.types';

// ============================================
// REMINDER SCHEMA
// ============================================

const RecurrenceSchema = new Schema(
    {
        enabled: { type: Boolean, default: false },
        frequency: {
            type: String,
            enum: Object.values(RecurrenceFrequency),
            default: RecurrenceFrequency.DAILY,
        },
        interval: { type: Number, min: 1 },
        daysOfWeek: [{ type: Number, min: 0, max: 6 }],
        endDate: { type: Date },
        endAfterOccurrences: { type: Number, min: 1 },
    },
    { _id: false }
);

const NotificationTimeSchema = new Schema(
    {
        type: {
            type: String,
            enum: Object.values(NotificationTimeType),
            required: true,
        },
        value: { type: Number, required: true, min: 1 },
    },
    { _id: false }
);

const NotificationSettingsSchema = new Schema(
    {
        enabled: { type: Boolean, default: true },
        times: [NotificationTimeSchema],
    },
    { _id: false }
);

const ReminderSchema = new Schema<IReminderDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true, },

        // Basic Info
        title: { type: String, required: true, trim: true, maxlength: 200, },
        description: { type: String, trim: true, maxlength: 2000, },

        // Scheduling
        date: { type: Date, required: true, index: true, },
        startTime: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, },
        endTime: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, },
        allDay: { type: Boolean, default: true, },

        // Recurrence
        recurring: { type: RecurrenceSchema, default: { enabled: false }, },
        parentReminderId: { type: Schema.Types.ObjectId, ref: 'Reminder', },

        // Notifications
        notifications: {
            type: NotificationSettingsSchema,
            default: { enabled: true, times: [{ type: NotificationTimeType.MINUTES, value: 10 }], },
        },

        // Priority & Status
        priority: { type: String, enum: Object.values(ReminderPriority), default: ReminderPriority.MEDIUM, index: true, },
        status: { type: String, enum: Object.values(ReminderStatus), default: ReminderStatus.PENDING, index: true, },
        completedAt: { type: Date, },

        // Integrations
        linkedTags: [{ type: Schema.Types.ObjectId, ref: 'Tag', },],
        linkedPeople: [{ type: Schema.Types.ObjectId, ref: 'Person', },],
        linkedEntries: [{ type: Schema.Types.ObjectId, ref: 'Entry', },],
        linkedGoals: [{ type: Schema.Types.ObjectId, ref: 'Goal', },],
    },
    { timestamps: true, }
);

// Indexes for performance
ReminderSchema.index({ userId: 1, date: 1 });
ReminderSchema.index({ userId: 1, status: 1 });
ReminderSchema.index({ userId: 1, priority: 1 });
ReminderSchema.index({ userId: 1, date: 1, status: 1 });

// ============================================
// NOTIFICATION QUEUE SCHEMA
// ============================================

const NotificationQueueSchema = new Schema<INotificationQueueDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true, },
        reminderId: { type: Schema.Types.ObjectId, ref: 'Reminder', required: true, index: true, },
        scheduledFor: { type: Date, required: true, index: true, },
        status: { type: String, enum: Object.values(NotificationStatus), default: NotificationStatus.PENDING, index: true, },
        sentAt: { type: Date, },
        error: { type: String, },
    },
    { timestamps: true, }
);

// Indexes for notification processing
NotificationQueueSchema.index({ status: 1, scheduledFor: 1 });
NotificationQueueSchema.index({ reminderId: 1, status: 1 });

// ============================================
// MODELS
// ============================================

export const Reminder = mongoose.model<IReminderDocument>('Reminder', ReminderSchema);
export const NotificationQueue = mongoose.model<INotificationQueueDocument>(
    'NotificationQueue',
    NotificationQueueSchema
);
