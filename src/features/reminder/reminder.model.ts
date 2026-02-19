import mongoose, { Schema } from 'mongoose';
import { IReminderDocument, NotificationTimeType, RecurrenceFrequency, ReminderPriority, ReminderStatus, } from './reminder.types';

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
        value: { type: Number, required: true, min: 0 },
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
        linkedEntities: [{ type: Schema.Types.ObjectId, ref: 'KnowledgeEntity', },],
        linkedEntries: [{ type: Schema.Types.ObjectId, ref: 'Entry', },],
        metadata: { type: Schema.Types.Mixed },
    },
    { timestamps: true, }
);

// Indexes for performance
ReminderSchema.index({ title: 'text', description: 'text' });
ReminderSchema.index({ userId: 1, date: 1 });
ReminderSchema.index({ userId: 1, status: 1 });
ReminderSchema.index({ userId: 1, priority: 1 });
ReminderSchema.index({ userId: 1, date: 1, status: 1 });

// Prevent duplicate pending reminders (Same user, title, date, time)
ReminderSchema.index(
    { userId: 1, title: 1, date: 1, startTime: 1 },
    {
        unique: true,
        partialFilterExpression: { status: ReminderStatus.PENDING },
        collation: { locale: 'en', strength: 2 }
    }
);

// ============================================
// MODELS
// ============================================

export const Reminder = mongoose.model<IReminderDocument>('Reminder', ReminderSchema);
