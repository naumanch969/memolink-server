import mongoose, { Schema } from 'mongoose';
import { IUsageStatsDocument } from '../enrichment.types';

const usageStatsSchema = new Schema<IUsageStatsDocument>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },

    totalSeconds: { type: Number, default: 0 },
    productiveSeconds: { type: Number, default: 0 },
    distractingSeconds: { type: Number, default: 0 },

    domainMap: { type: Schema.Types.Map, of: Number, default: {} },

    topDomains: [{
        domain: { type: String },
        seconds: { type: Number }
    }],

    appStats: [{
        appName: { type: String },
        duration: { type: Number },
        interactions: { type: Number, default: 0 }
    }],

    lastUpdated: { type: Date, default: Date.now }
}, {
    timestamps: true,
    collection: 'usage_stats'
});

// Compound index for unique session per user
usageStatsSchema.index({ userId: 1, sessionId: 1 }, { unique: true });

export const UsageStats = mongoose.model<IUsageStatsDocument>('UsageStats', usageStatsSchema);
export default UsageStats;
