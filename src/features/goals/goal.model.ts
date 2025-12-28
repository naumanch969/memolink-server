import mongoose, { Schema } from 'mongoose';
import { IGoal, ICheckpoint } from '../../shared/types';
import { COLLECTIONS } from '../../shared/constants';

// Checkpoint Schema
const checkpointSchema = new Schema<ICheckpoint>({
    goalId: { type: Schema.Types.ObjectId, ref: 'Goal', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000 },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date },
    order: { type: Number, default: 0 },
    entries: [{ type: Schema.Types.ObjectId, ref: 'Entry' }]
}, {
    timestamps: true,
    collection: 'checkpoints'
});

// Indexes for checkpoints
checkpointSchema.index({ goalId: 1, order: 1 });

// Weekly Goal Schema
const goalSchema = new Schema<IGoal>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    year: { type: Number, required: true, min: 2000, max: 2100 },
    weekNumber: { type: Number, required: true, min: 1, max: 53 },
    weekStartDate: { type: Date, required: true },
    weekEndDate: { type: Date, required: true },
    checkpoints: [{ type: Schema.Types.ObjectId, ref: 'Checkpoint' }],
    status: {
        type: String,
        enum: ['active', 'completed', 'archived'],
        default: 'active',
        index: true
    },
    notes: { type: String, trim: true, maxlength: 2000 },
    currentValue: { type: Number, default: 0 },
    targetValue: { type: Number, default: 0 },
    linkedTags: [{ type: Schema.Types.ObjectId, ref: 'Tag' }]
}, {
    timestamps: true,
    collection: COLLECTIONS.GOALS
});

// Indexes for performance
goalSchema.index({ userId: 1, year: 1, weekNumber: 1 }, { unique: true });
goalSchema.index({ userId: 1, status: 1 });
goalSchema.index({ weekStartDate: 1, weekEndDate: 1 });

export const Checkpoint = mongoose.model<ICheckpoint>('Checkpoint', checkpointSchema);
export const Goal = mongoose.model<IGoal>('Goal', goalSchema);
export default Goal;
