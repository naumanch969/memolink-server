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
        error: { type: String, },
        startedAt: Date,
        completedAt: Date,
    },
    { timestamps: true, collection: 'agent_tasks', }
);

export const AgentTask: Model<IAgentTaskDocument> = mongoose.model<IAgentTaskDocument>('AgentTask', agentTaskSchema);
