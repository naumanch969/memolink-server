import mongoose, { Schema } from 'mongoose';
import { COLLECTIONS, GOAL_STATUS, ROUTINE_TYPES, } from '../../shared/constants';
import { GoalPeriod, GoalTrackingType, IGoal } from './goal.interfaces';

// ============================================
// SUB-SCHEMAS
// ============================================

const trackingScheduleSchema = new Schema(
    {
        frequency: {
            type: String,
            enum: ['daily', 'weekdays', 'specific_days', 'interval'],
            required: true
        },
        specificDays: [{ type: Number }], // 0-6
        intervalValue: { type: Number },
        timesPerPeriod: { type: Number }
    },
    { _id: false }
);

const trackingConfigSchema = new Schema(
    {
        type: {
            type: String,
            enum: Object.values(GoalTrackingType),
            required: true
        },
        targetValue: { type: Number },
        targetItems: [{ type: String }],
        unit: { type: String, trim: true },
    },
    { _id: false }
);

const goalProgressSchema = new Schema(
    {
        currentValue: { type: Number },
        completedItems: [{ type: String }],
        streakCurrent: { type: Number, default: 0 },
        streakLongest: { type: Number, default: 0 },
        totalCompletions: { type: Number, default: 0 },
        lastLogDate: { type: Date },
        notes: { type: String },
        lastUpdate: { type: Date },
    },
    { _id: false }
);

const goalMilestoneSchema = new Schema(
    {
        title: { type: String, required: true },
        targetValue: { type: Number },
        deadline: { type: Date },
        completed: { type: Boolean, default: false },
        completedAt: { type: Date },
    },
    { _id: true } // Subdocuments get IDs
);

// ============================================
// MAIN GOAL SCHEMA
// ============================================

const goalSchema = new Schema<IGoal>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true,
        },
        title: {
            type: String,
            required: [true, 'Goal title is required'],
            trim: true,
            maxlength: [200, 'Title cannot exceed 200 characters'],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [2000, 'Description cannot exceed 2000 characters'],
        },
        why: {
            type: String,
            trim: true,
            maxlength: [1000, 'Motivation (Why) cannot exceed 1000 characters'],
        },
        icon: { type: String, trim: true },
        color: { type: String, trim: true },

        period: {
            type: String,
            enum: Object.values(GoalPeriod),
            required: true,
            default: GoalPeriod.INDEFINITE
        },

        parentId: {
            type: Schema.Types.ObjectId,
            ref: 'Goal',
            index: true
        },

        trackingSchedule: {
            type: trackingScheduleSchema
        },
        trackingConfig: {
            type: trackingConfigSchema
        },

        // Legacy RoutineType - keeping?
        type: {
            type: String,
            // required: [true, 'Goal type is required'], // Relax requirement if moving to period
            enum: Object.values(ROUTINE_TYPES),
        },

        status: {
            type: String,
            required: true,
            enum: Object.values(GOAL_STATUS),
            default: GOAL_STATUS.ACTIVE,
            index: true,
        },

        // config: {
        //     type: goalConfigSchema,
        //     required: true,
        //     default: {},
        // },

        progress: {
            type: goalProgressSchema,
            required: true,
            default: {},
        },

        startDate: {
            type: Date,
            required: true,
            default: Date.now,
        },
        deadline: {
            type: Date,
            index: true,
        },
        completedAt: {
            type: Date,
        },

        linkedRoutines: [
            {
                type: Schema.Types.ObjectId,
                ref: 'RoutineTemplate',
            },
        ],

        milestones: [goalMilestoneSchema],

        priority: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium',
        },

        tags: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Tag',
            },
        ],

        reward: { type: String, trim: true },
        metadata: { type: Schema.Types.Mixed },
    },
    {
        timestamps: true,
        collection: COLLECTIONS.GOALS,
    }
);

// ============================================
// INDEXES & MIDDLEWARE
// ============================================

// Unique active goal per user (Case-insensitive)
goalSchema.index(
    { userId: 1, title: 1 },
    {
        unique: true,
        partialFilterExpression: { status: GOAL_STATUS.ACTIVE },
        collation: { locale: 'en', strength: 2 }
    }
);

goalSchema.index({ userId: 1, status: 1 });
goalSchema.index({ userId: 1, deadline: 1 });
goalSchema.index({ title: 'text', description: 'text', why: 'text' });

// Auto-set completedAt when status changes to completed
goalSchema.pre('save', function (next) {
    if (this.isModified('status')) {
        if (this.status === GOAL_STATUS.COMPLETED && !this.completedAt) {
            this.completedAt = new Date();
        } else if (this.status !== GOAL_STATUS.COMPLETED) {
            // If moved back from completed, clear the date? 
            // Optional decision, but usually safer to keep or clear. Clear for accuracy.
            this.completedAt = undefined;
        }
    }
    next();
});

export const Goal = mongoose.model<IGoal>('Goal', goalSchema);
export default Goal;
