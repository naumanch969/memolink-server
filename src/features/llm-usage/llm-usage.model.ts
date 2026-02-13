import mongoose, { Document, Schema } from 'mongoose';

export interface ILLMUsageLog extends Document {
    userId: string;
    workflow: string;
    modelName: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUSD: number;
    durationMs: number;
    createdAt: Date;
}

const llmUsageLogSchema = new Schema<ILLMUsageLog>({
    userId: { type: String, required: true, index: true },
    workflow: { type: String, required: true, index: true },
    modelName: { type: String, required: true },
    promptTokens: { type: Number, required: true, min: 0 },
    completionTokens: { type: Number, required: true, min: 0 },
    totalTokens: { type: Number, required: true, min: 0 },
    estimatedCostUSD: { type: Number, required: true, min: 0 },
    durationMs: { type: Number, required: true, min: 0 }
}, {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'llm_usage_logs'
});

// TTL index: auto-delete logs older than 90 days
llmUsageLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Compound index for admin aggregation queries
llmUsageLogSchema.index({ createdAt: -1, workflow: 1 });

export const LLMUsageLog = mongoose.model<ILLMUsageLog>('LLMUsageLog', llmUsageLogSchema);
