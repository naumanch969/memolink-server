import mongoose, { Schema } from 'mongoose';
import { IRoutineTemplate, IRoutineLog, IUserRoutinePreferences, } from '../../shared/types';
import { COLLECTIONS, ROUTINE_TYPES, ROUTINE_STATUS, } from '../../shared/constants';

// ============================================
// ROUTINE TEMPLATE SCHEMA
// ============================================

const routineConfigSchema = new Schema(
    {
        items: [{ type: String, trim: true }],
        target: { type: Number, min: 0 },
        unit: { type: String, trim: true },
        scale: { type: Number, min: 2, max: 10 },
        scaleLabels: [{ type: String }],
        prompt: { type: String, trim: true },
        targetTime: { type: String, match: /^([01]\d|2[0-3]):([0-5]\d)$/ },
    },
    { _id: false }
);

const routineScheduleSchema = new Schema(
    {
        activeDays: {
            type: [{ type: Number, min: 0, max: 6 }],
            required: true,
            validate: {
                validator: (v: number[]) => v.length > 0 && v.length <= 7,
                message: 'Active days must have at least 1 and at most 7 days',
            },
        },
    },
    { _id: false }
);

const routineStreakDataSchema = new Schema(
    {
        currentStreak: { type: Number, default: 0, min: 0 },
        longestStreak: { type: Number, default: 0, min: 0 },
        totalCompletions: { type: Number, default: 0, min: 0 },
        lastCompletedDate: { type: Date },
    },
    { _id: false }
);

const routineTemplateSchema = new Schema<IRoutineTemplate>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true,
        },
        name: {
            type: String,
            required: [true, 'Routine name is required'],
            trim: true,
            minlength: [1, 'Name must be at least 1 character'],
            maxlength: [100, 'Name cannot exceed 100 characters'],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [500, 'Description cannot exceed 500 characters'],
        },
        icon: {
            type: String,
            trim: true,
        },
        type: {
            type: String,
            required: [true, 'Routine type is required'],
            enum: Object.values(ROUTINE_TYPES),
        },
        config: {
            type: routineConfigSchema,
            required: true,
            default: {},
        }, 
        schedule: {
            type: routineScheduleSchema,
            required: true,
        },
        completionMode: {
            type: String,
            enum: ['strict', 'gradual'],
            default: 'strict',
        },
        gradualThreshold: {
            type: Number,
            min: 1,
            max: 100,
            default: 80,
        },
        streakData: {
            type: routineStreakDataSchema,
            default: () => ({
                currentStreak: 0,
                longestStreak: 0,
                totalCompletions: 0,
            }),
        },
        status: {
            type: String,
            enum: Object.values(ROUTINE_STATUS),
            default: ROUTINE_STATUS.ACTIVE,
            index: true,
        },
        linkedTags: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Tag',
            },
        ],
        order: {
            type: Number,
            default: 0,
        },
        archivedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
        collection: COLLECTIONS.ROUTINE_TEMPLATES,
    }
);

// Indexes for performance
routineTemplateSchema.index({ userId: 1, status: 1 });
routineTemplateSchema.index({ userId: 1, order: 1 });
routineTemplateSchema.index({ userId: 1, createdAt: -1 });

// Pre-save middleware to set archivedAt
routineTemplateSchema.pre('save', function (next) {
    if (this.status === ROUTINE_STATUS.ARCHIVED && !this.archivedAt) {
        this.archivedAt = new Date();
    } else if (this.status !== ROUTINE_STATUS.ARCHIVED) {
        this.archivedAt = undefined;
    }
    next();
});

// ============================================
// ROUTINE LOG SCHEMA
// ============================================

const routineLogDataSchema = new Schema(
    {
        completed: { type: Boolean },
        checkedItems: [{ type: Boolean }],
        value: { type: Number, min: 0 },
        text: { type: String, trim: true, maxlength: 1000 },
        time: { type: String, match: /^([01]\d|2[0-3]):([0-5]\d)$/ },
    },
    { _id: false }
);

const routineLogSchema = new Schema<IRoutineLog>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true,
        },
        routineId: {
            type: Schema.Types.ObjectId,
            ref: 'RoutineTemplate',
            required: [true, 'Routine ID is required'],
            index: true,
        },
        date: {
            type: Date,
            required: [true, 'Date is required'],
            index: true,
        },
        data: {
            type: routineLogDataSchema,
            required: true,
            default: {},
        },
        completionPercentage: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
        },
        countsForStreak: {
            type: Boolean,
            default: false,
        },
        journalEntryId: {
            type: Schema.Types.ObjectId,
            ref: 'Entry',
            index: true,
        },
        loggedAt: {
            type: Date,
            default: Date.now,
        }
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
routineLogSchema.index({ journalEntryId: 1 });

// Compound unique index to prevent duplicate logs for same routine on same day
routineLogSchema.index(
    { userId: 1, routineId: 1, date: 1 },
    { unique: true }
);

// Pre-save middleware to normalize date to start of day
// Pre-save middleware to normalize date to start of day
routineLogSchema.pre('save', function (next) {
    if (this.date) {
        const normalized = new Date(this.date);
        normalized.setUTCHours(0, 0, 0, 0);
        this.date = normalized;
    }
    next();
});

// ============================================
// USER ROUTINE PREFERENCES SCHEMA
// ============================================

const customReminderSchema = new Schema(
    {
        routineId: {
            type: Schema.Types.ObjectId,
            ref: 'RoutineTemplate',
            required: true,
        },
        time: {
            type: String,
            required: true,
            match: /^([01]\d|2[0-3]):([0-5]\d)$/,
        },
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
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            unique: true,
            index: true,
        },
        reminders: {
            type: reminderSettingsSchema,
            default: () => ({
                enabled: false,
                smartReminders: false,
                customReminders: [],
            }),
        },
        defaultView: {
            type: String,
            enum: ['list', 'grid', 'compact'],
            default: 'list',
        },
        showStreaksOnCalendar: {
            type: Boolean,
            default: true,
        },
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
