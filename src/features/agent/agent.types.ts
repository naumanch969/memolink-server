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
    ENRICHMENT = 'ENRICHMENT',
    MEDIA_PROCESSING = 'MEDIA_PROCESSING',
}

export enum AgentTaskStatus {
    PENDING = 'PENDING',
    RUNNING = 'RUNNING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED',
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

export interface EnrichmentInput {
    entryId: string;
    userId: string;
    signalTier?: string;
}

export interface MediaProcessingInput {
    entryId: string;
    userId: string;
    mediaType: 'image' | 'video' | 'audio';
    url: string;
}

/**
 * Type Mapping for strict safety
 */
export interface AgentTaskPayloads {
    [AgentTaskType.LINKEDIN_PROFILE_PARSE]: { input: { profileUrl: string }; output: any };
    [AgentTaskType.SYNC]: { input: SyncInput; output: { syncedCount: number } };
    [AgentTaskType.PERSONA_SYNTHESIS]: { input: PersonaSynthesisInput; output: any };
    [AgentTaskType.WEB_ACTIVITY_SUMMARY]: { input: WebActivityInput; output: any };
    [AgentTaskType.MEMORY_FLUSH]: { input: MemoryFlushInput; output: { flushedCount: number } };
    [AgentTaskType.ENTITY_CONSOLIDATION]: { input: ConsolidationInput; output: any };
    [AgentTaskType.COGNITIVE_CONSOLIDATION]: { input: ConsolidationInput; output: any };
    [AgentTaskType.RETROACTIVE_LINKING]: { input: any; output: any };
    [AgentTaskType.WEEKLY_ANALYSIS]: { input: any; output: any };
    [AgentTaskType.MONTHLY_ANALYSIS]: { input: any; output: any };
    [AgentTaskType.ENRICHMENT]: { input: EnrichmentInput; output: any };
    [AgentTaskType.MEDIA_PROCESSING]: { input: MediaProcessingInput; output: any };
    // Default fallback for others
    [key: string]: { input: any; output: any };
}

export type AgentTaskInput<T extends AgentTaskType = AgentTaskType> = AgentTaskPayloads[T]['input'];
export type AgentTaskOutput<T extends AgentTaskType = AgentTaskType> = AgentTaskPayloads[T]['output'];

export interface IAgentTask<T extends AgentTaskType = AgentTaskType> {
    userId: Types.ObjectId;
    type: T;
    status: AgentTaskStatus;
    inputData: AgentTaskInput<T>;
    outputData?: AgentTaskOutput<T>;
    currentStep?: string;
    priority?: number; // 1 = high, 10 = low
    stats?: {
        tokens?: number;
        stepsCount?: number;
        [key: string]: any;
    };
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

export interface IChatMessage {
    role: MessageRole;
    content: string;
    timestamp: number;
}

export type ProgressCallback = (step: string, meta?: any) => Promise<void>;

export interface IAgentWorkflow {
    type: AgentTaskType;
    execute(
        task: IAgentTaskDocument, 
        emitProgress: ProgressCallback, 
        signal: AbortSignal
    ): Promise<any>;
}
