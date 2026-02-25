import mongoose, { Schema } from 'mongoose';
import { IReport, ReportStatus, ReportType } from './report.types';

const reportSchema = new Schema<IReport>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(ReportType), required: true, index: true },
    status: { type: String, enum: Object.values(ReportStatus), default: ReportStatus.PUBLISHED },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    content: { type: Schema.Types.Mixed, required: true },
    metadata: {
        viewCount: { type: Number, default: 0 },
        lastViewedAt: { type: Date },
        generatedByTaskId: { type: Schema.Types.ObjectId, ref: 'AgentTask' }
    }
}, {
    timestamps: true
});

// Indexes for common queries
reportSchema.index({ userId: 1, type: 1, startDate: -1 });
reportSchema.index({ userId: 1, createdAt: -1 });

// UNIQUE INDEX to prevent duplicate reports for the same period
reportSchema.index({ userId: 1, type: 1, startDate: 1, endDate: 1 }, { unique: true });

export const Report = mongoose.model<IReport>('Report', reportSchema);
export default Report;
