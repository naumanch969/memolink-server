import mongoose, { Schema } from 'mongoose';
import { ChallengeStatus, ChallengeType, IChallengeDocument, IChallengeLogDocument } from './challenge.interfaces';

const ChallengeSchema = new Schema<IChallengeDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        goalId: { type: Schema.Types.ObjectId, ref: 'Goal', index: true },
        title: { type: String, required: true },
        description: { type: String },
        duration: { type: Number, enum: [7, 14, 30], required: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        status: {
            type: String,
            enum: Object.values(ChallengeStatus),
            default: ChallengeStatus.ACTIVE,
            index: true
        },
        type: {
            type: String,
            enum: Object.values(ChallengeType),
            required: true
        },
        config: {
            targetValue: { type: Number },
            unit: { type: String },
            failureThreshold: { type: Number, default: 3 }
        },
        stats: {
            completionPercentage: { type: Number, default: 0 },
            currentStreak: { type: Number, default: 0 },
            totalCompletions: { type: Number, default: 0 },
            missedDays: { type: Number, default: 0 },
            lastLoggedDay: { type: Number }
        },
        metadata: { type: Schema.Types.Mixed, default: {} }
    },
    {
        timestamps: true
    }
);

ChallengeSchema.index({ userId: 1, status: 1 });

export const Challenge = mongoose.model<IChallengeDocument>('Challenge', ChallengeSchema);


const ChallengeLogSchema = new Schema<IChallengeLogDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        challengeId: { type: Schema.Types.ObjectId, ref: 'Challenge', required: true, index: true },
        dayIndex: { type: Number, required: true },
        date: { type: Date, required: true },
        status: {
            type: String,
            enum: ['completed', 'missed', 'skipped', 'pending'],
            default: 'pending',
            index: true
        },
        value: { type: Schema.Types.Mixed },
        notes: { type: String },
        loggedAt: { type: Date }
    },
    {
        timestamps: true
    }
);

// Ensure unique log per challenge per day
ChallengeLogSchema.index({ challengeId: 1, dayIndex: 1 }, { unique: true });
ChallengeLogSchema.index({ userId: 1, date: 1 });

export const ChallengeLog = mongoose.model<IChallengeLogDocument>('ChallengeLog', ChallengeLogSchema);
