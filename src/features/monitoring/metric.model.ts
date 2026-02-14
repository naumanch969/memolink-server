import mongoose, { Document, Schema } from 'mongoose';

export interface ISystemMetric extends Document {
    key: string;       // e.g., "ai:tokens:total"
    value: number;     // Aggregate value for this period
    period: string;    // "YYYY-MM-DD:HH" for hourly, "YYYY-MM-DD" for daily, or "all-time"
    metadata?: Record<string, any>;
    lastUpdatedAt: Date;
}

const SystemMetricSchema = new Schema<ISystemMetric>({
    key: { type: String, required: true, index: true },
    value: { type: Number, default: 0 },
    period: { type: String, required: true, index: true },
    metadata: { type: Schema.Types.Mixed },
    lastUpdatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound index to ensure uniqueness per metric per period
SystemMetricSchema.index({ key: 1, period: 1 }, { unique: true });

export const SystemMetric = mongoose.model<ISystemMetric>('SystemMetric', SystemMetricSchema);
