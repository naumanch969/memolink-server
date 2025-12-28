
import mongoose, { Schema } from 'mongoose';
import { IInsight, InsightType } from './insights.interfaces';

const insightSchema = new Schema<IInsight>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(InsightType), required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    data: { type: Schema.Types.Mixed, required: true }, // Store flexible JSON data
}, {
    timestamps: true,
});

// Compound index for quick lookup of specific period insights
insightSchema.index({ userId: 1, type: 1, periodStart: -1 });

export const Insight = mongoose.model<IInsight>('Insight', insightSchema);
export default Insight;
