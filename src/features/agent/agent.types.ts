import { Types } from "mongoose";
import { IAgentTaskDocument } from "./agent.model";

export enum AgentTaskType {
    LINKEDIN_PROFILE_PARSE = 'LINKEDIN_PROFILE_PARSE',
    CHECKLIST_CREATE = 'CHECKLIST_CREATE',
    REMINDER_CREATE = 'REMINDER_CREATE',
    REMINDER_UPDATE = 'REMINDER_UPDATE',
    GOAL_CREATE = 'GOAL_CREATE',
    DAILY_BRIEFING = 'DAILY_BRIEFING',
    KNOWLEDGE_QUERY = 'KNOWLEDGE_QUERY',
    WEB_ACTIVITY_SUMMARY = 'WEB_ACTIVITY_SUMMARY',
    SYNC = 'SYNC',
    PERSONA_SYNTHESIS = 'PERSONA_SYNTHESIS',
    MEMORY_FLUSH = 'MEMORY_FLUSH',
    ENTITY_CONSOLIDATION = 'ENTITY_CONSOLIDATION',
    RETROACTIVE_LINKING = 'RETROACTIVE_LINKING',
    COGNITIVE_CONSOLIDATION = 'COGNITIVE_CONSOLIDATION',
    WEEKLY_ANALYSIS = 'WEEKLY_ANALYSIS',
    MONTHLY_ANALYSIS = 'MONTHLY_ANALYSIS',
    DAILY_REFLECTION = 'DAILY_REFLECTION',
}

export enum AgentTaskStatus {
    PENDING = 'PENDING',
    RUNNING = 'RUNNING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

export enum WorkflowStatus {
    COMPLETED = 'completed',
    FAILED = 'failed',
    PENDING = 'pending',
}

export enum MessageRole {
    USER = 'user',
    AGENT = 'agent',
    SYSTEM = 'system',
}

/**
 * TASK DATA CONTRACTS
 */

export interface PersonaSynthesisInput {
    force?: boolean;
}

export interface SyncInput {
    entryId?: string;
    force?: boolean;
}

export interface WebActivityInput {
    date?: string;
    limit?: number;
}

export interface MemoryFlushInput {
    count?: number;
}

export interface ConsolidationInput {
    entryId?: string;
    entityId?: string;
}

export type AgentTaskInput =
    | PersonaSynthesisInput
    | SyncInput
    | WebActivityInput
    | MemoryFlushInput
    | ConsolidationInput
    | any; // Fallback for legacy

export interface IAgentTask {
    userId: Types.ObjectId;
    type: AgentTaskType;
    status: AgentTaskStatus;
    inputData: AgentTaskInput;
    outputData?: any;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
    startedAt?: Date;
    completedAt?: Date;
}

export type AgentWorkflowResult = {
    status: WorkflowStatus;
    result?: any;
    error?: string;
};

export type AgentWorkflow = (task: IAgentTask) => Promise<AgentWorkflowResult>;

export interface IChatMessage {
    role: MessageRole;
    content: string;
    timestamp: number;
}

export interface IAgentWorkflow {
    type: string;
    execute(task: IAgentTaskDocument): Promise<any>;
}
