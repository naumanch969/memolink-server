import mongoose, { Schema } from 'mongoose';
import DateManager from '../../core/utils/date-manager.util';
import { COLLECTIONS, ROUTINE_STATUS, ROUTINE_TYPES, } from '../../shared/constants';
import { IRoutineLog, IRoutineTemplate, IUserRoutinePreferences } from './routine.interfaces';

// ============================================
// ROUTINE TEMPLATE SCHEMA
// ============================================

const routineConfigSchema = new Schema(
    {
        // Common
        items: [{ type: String, trim: true }],
        target: { type: Number },
        unit: { type: String, trim: true },

        // Scale
        min: { type: Number },
        max: { type: Number },
        minLabel: { type: String },
        maxLabel: { type: String },
        step: { type: Number },

        // Text
        maxLength: { type: Number },
        placeholder: { type: String },
        multiline: { type: Boolean },

        // Time
        format: { type: String, enum: ['12', '24'] },

        // Boolean
        trueLabel: { type: String },
        falseLabel: { type: String },

        // Duration
        targetSeconds: { type: Number },
    },
    { _id: false }
);

const scheduleConfigSchema = new Schema(
    {
        type: {
            type: String,
            enum: ['specific_days', 'frequency', 'interval'],
            required: true,
            default: 'specific_days',
        },
        // Mode A: Specific
        days: [{ type: Number, min: 0, max: 6 }],
        dates: [{ type: Number, min: 1, max: 31 }],

        // Mode B: Frequency
        frequencyCount: { type: Number },
        frequencyPeriod: { type: String, enum: ['week', 'month'] },

        // Mode C: Interval
        intervalValue: { type: Number },
        intervalUnit: { type: String, enum: ['day', 'week', 'month'] },
    },
    { _id: false }
);

const streakConfigSchema = new Schema(
    {
        allowSkips: { type: Boolean, default: false },
        maxBankedSkips: { type: Number, default: 0 },
        skipCost: { type: Number, default: 1 },
    },
    { _id: false }
);

const routineStreakDataSchema = new Schema(
    {
        currentStreak: { type: Number, default: 0, min: 0 },
        longestStreak: { type: Number, default: 0, min: 0 },
        totalCompletions: { type: Number, default: 0, min: 0 },
        lastCompletedDate: { type: Date },
        bankedSkips: { type: Number, default: 0, min: 0 },
    },
    { _id: false }
);

const routineTemplateSchema = new Schema<IRoutineTemplate>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'User ID is required'], index: true, },
        name: { type: String, required: true },
        description: { type: String },
        icon: { type: String },
        type: { type: String, enum: Object.values(ROUTINE_TYPES), required: true, },

        config: { type: routineConfigSchema, default: {} },
        schedule: { type: scheduleConfigSchema, required: true },
        streakConfig: {
            type: streakConfigSchema,
            default: () => ({ allowSkips: false, maxBankedSkips: 0, skipCost: 1 }),
        },

        completionMode: { type: String, enum: ['strict', 'gradual'], default: 'strict', },
        gradualThreshold: { type: Number },

        streakData: {
            type: routineStreakDataSchema,
            default: () => ({
                currentStreak: 0,
                longestStreak: 0,
                totalCompletions: 0,
                bankedSkips: 0,
            }),
        },

        status: {
            type: String,
            enum: Object.values(ROUTINE_STATUS),
            default: ROUTINE_STATUS.ACTIVE,
            index: true,
        },

        linkedGoals: [{ type: Schema.Types.ObjectId, ref: 'Goal' }],
        linkedTags: [{ type: Schema.Types.ObjectId, ref: 'Tag' }],
        order: { type: Number, default: 0 },
        archivedAt: { type: String }, // ISO Date string
    },
    {
        timestamps: true,
        collection: COLLECTIONS.ROUTINE_TEMPLATES, // Changed to ROUTINE_TEMPLATE as per instruction
    }
);

// Indexes for performance
routineTemplateSchema.index({ userId: 1, status: 1 });
routineTemplateSchema.index({ userId: 1, order: 1 });
routineTemplateSchema.index({ userId: 1, createdAt: -1 });

// Pre-save middleware to set archivedAt
// Pre-save middleware to set archivedAt
routineTemplateSchema.pre('save', function (next) {
    const doc = this as unknown as IRoutineTemplate;
    if (doc.status === ROUTINE_STATUS.ARCHIVED && !doc.archivedAt) {
        doc.archivedAt = new Date().toISOString();
    } else if (doc.status !== ROUTINE_STATUS.ARCHIVED) {
        doc.archivedAt = undefined;
    }
    next();
});

// ============================================
// ROUTINE LOG SCHEMA
// ============================================

const routineLogDataSchema = new Schema(
    {
        value: { type: Schema.Types.Mixed }, // Can be boolean, number, string, array
        notes: { type: String, trim: true },
    },
    { _id: false }
);

const routineLogSchema = new Schema<IRoutineLog>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'User ID is required'], index: true, },
        routineId: { type: Schema.Types.ObjectId, ref: 'RoutineTemplate', required: [true, 'Routine ID is required'], index: true, },
        date: { type: Date, required: [true, 'Date is required'], index: true, },
        data: { type: routineLogDataSchema, required: true, default: {}, },
        completionPercentage: { type: Number, min: 0, max: 100, default: 0, },
        countsForStreak: { type: Boolean, default: false, },
        journalEntryId: { type: Schema.Types.ObjectId, ref: 'Entry', index: true, },
        loggedAt: { type: Date, default: Date.now, }
    },
    {
        timestamps: true,
        collection: COLLECTIONS.ROUTINE_LOGS,
    }
);

// Indexes for performance
routineLogSchema.index({ userId: 1, date: -1 });
routineLogSchema.index({ userId: 1, routineId: 1, date: -1 });
routineLogSchema.index({ routineId: 1, date: -1 });

// Compound unique index to prevent duplicate logs for same routine on same day
routineLogSchema.index(
    { userId: 1, routineId: 1, date: 1 },
    { unique: true }
);

// Pre-save middleware to normalize date to start of day
routineLogSchema.pre('save', function (next) {
    if (this.date) {
        this.date = DateManager.normalizeToUTC(this.date);
    }
    next();
});

// ============================================
// USER ROUTINE PREFERENCES SCHEMA
// ============================================

const customReminderSchema = new Schema(
    {
        routineId: { type: Schema.Types.ObjectId, ref: 'RoutineTemplate', required: true, },
        time: { type: String, required: true, match: /^([01]\d|2[0-3]):([0-5]\d)$/, },
        message: { type: String, trim: true },
    },
    { _id: false }
);

const reminderSettingsSchema = new Schema(
    {
        enabled: { type: Boolean, default: false },
        dailyReminderTime: {
            type: String,
            match: /^([01]\d|2[0-3]):([0-5]\d)$/,
        },
        smartReminders: { type: Boolean, default: false },
        customReminders: [customReminderSchema],
    },
    { _id: false }
);

const userRoutinePreferencesSchema = new Schema<IUserRoutinePreferences>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'User ID is required'], unique: true, index: true, },
        reminders: {
            type: reminderSettingsSchema,
            default: () => ({
                enabled: false,
                smartReminders: false,
                customReminders: [],
            }),
        },
        defaultView: { type: String, enum: ['list', 'grid', 'compact'], default: 'list', },
        showStreaksOnCalendar: { type: Boolean, default: true, },
    },
    {
        timestamps: true,
        collection: COLLECTIONS.ROUTINE_PREFERENCES,
    }
);

// Export models
export const RoutineTemplate = mongoose.model<IRoutineTemplate>('RoutineTemplate', routineTemplateSchema);
export const RoutineLog = mongoose.model<IRoutineLog>('RoutineLog', routineLogSchema);
export const UserRoutinePreferences = mongoose.model<IUserRoutinePreferences>('UserRoutinePreferences', userRoutinePreferencesSchema);

export default RoutineTemplate;
