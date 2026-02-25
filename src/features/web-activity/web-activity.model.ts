import { Schema, model } from 'mongoose';
import { IWebActivity } from './web-activity.types';

const webActivitySchema = new Schema<IWebActivity>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        date: { type: String, required: true, index: true },
        totalSeconds: { type: Number, default: 0 },
        productiveSeconds: { type: Number, default: 0 },
        distractingSeconds: { type: Number, default: 0 },
        domainMap: { type: Schema.Types.Map, of: Number, default: {} },
        summaryCreated: { type: Boolean, default: false },
    },
    {
        timestamps: true,
    }
);

// Compound index for unique daily entry per user
webActivitySchema.index({ userId: 1, date: 1 }, { unique: true });

export const WebActivity = model<IWebActivity>('WebActivity', webActivitySchema);
