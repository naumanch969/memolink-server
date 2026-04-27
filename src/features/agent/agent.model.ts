import mongoose, { Document, Model, Schema } from 'mongoose';
import { AgentTaskStatus, AgentTaskType, IAgentTask } from './agent.types';

export interface IAgentTaskDocument extends IAgentTask, Document { }

const agentTaskSchema = new Schema<IAgentTaskDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true, },
        type: { type: String, enum: Object.values(AgentTaskType), required: true, },
        status: { type: String, enum: Object.values(AgentTaskStatus), default: AgentTaskStatus.PENDING, index: true, },
        inputData: { type: Schema.Types.Mixed, default: {}, },
        outputData: { type: Schema.Types.Mixed, },
        currentStep: { type: String, },
        priority: { type: Number, default: 10, min: 1, max: 10 },
        stats: { type: Schema.Types.Mixed, default: { tokens: 0, stepsCount: 0 } },
        error: { type: String, },
        startedAt: Date,
        completedAt: Date,
    },
    { timestamps: true, collection: 'agent_tasks', }
);

// TTL Index for Ephemeral Tasks (30 days retention for completed Enrichment/Media tasks)
agentTaskSchema.index(
    { completedAt: 1 },
    { 
        expireAfterSeconds: 2592000, 
        partialFilterExpression: { 
            type: { $in: [AgentTaskType.ENRICHMENT, AgentTaskType.MEDIA_PROCESSING] },
            status: AgentTaskStatus.COMPLETED
        }
    }
);

export const AgentTask: Model<IAgentTaskDocument> = mongoose.model<IAgentTaskDocument>('AgentTask', agentTaskSchema);
