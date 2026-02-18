import mongoose, { Schema } from 'mongoose';
import { IScheduleDocument, ScheduleAction, ScheduleStatus } from './schedule.interfaces';

const ScheduleSchema = new Schema<IScheduleDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        type: { type: String, required: true, index: true },
        action: {
            type: String,
            enum: Object.values(ScheduleAction),
            required: true
        },
        payload: { type: Schema.Types.Mixed, default: {} },
        cronExpression: { type: String },
        nextRunAt: { type: Date, required: true, index: true },
        status: {
            type: String,
            enum: Object.values(ScheduleStatus),
            default: ScheduleStatus.ACTIVE,
            index: true
        },
        referenceId: { type: Schema.Types.ObjectId, index: true },
        referenceModel: { type: String },
        metadata: { type: Schema.Types.Mixed, default: {} }
    },
    {
        timestamps: true
    }
);

// Indexes for the scheduler runner
ScheduleSchema.index({ status: 1, nextRunAt: 1 });
ScheduleSchema.index({ userId: 1, type: 1 });

export const Schedule = mongoose.model<IScheduleDocument>('Schedule', ScheduleSchema);
