export enum AgentTaskType {
    DAILY_REFLECTION = 'DAILY_REFLECTION',
    ENTRY_TAGGING = 'ENTRY_TAGGING',
    ENTITY_EXTRACTION = 'ENTITY_EXTRACTION',
    LINKEDIN_PROFILE_PARSE = 'LINKEDIN_PROFILE_PARSE',
    BRAIN_DUMP = 'BRAIN_DUMP',
    CHECKLIST_CREATE = 'CHECKLIST_CREATE',
    REMINDER_CREATE = 'REMINDER_CREATE',
    REMINDER_UPDATE = 'REMINDER_UPDATE',
    GOAL_CREATE = 'GOAL_CREATE',
    DAILY_BRIEFING = 'DAILY_BRIEFING',
    EMBED_ENTRY = 'EMBED_ENTRY',
    KNOWLEDGE_QUERY = 'KNOWLEDGE_QUERY',
    WEB_ACTIVITY_SUMMARY = 'WEB_ACTIVITY_SUMMARY',
    INTENT_PROCESSING = 'INTENT_PROCESSING',
    SYNC = 'SYNC',
    PERSONA_SYNTHESIS = 'PERSONA_SYNTHESIS',
    MEMORY_FLUSH = 'MEMORY_FLUSH',
    ENTITY_CONSOLIDATION = 'ENTITY_CONSOLIDATION',
    RETROACTIVE_LINKING = 'RETROACTIVE_LINKING',
    COGNITIVE_CONSOLIDATION = 'COGNITIVE_CONSOLIDATION',
    WEEKLY_ANALYSIS = 'WEEKLY_ANALYSIS',
    MONTHLY_ANALYSIS = 'MONTHLY_ANALYSIS',
}

export enum AgentTaskStatus {
    PENDING = 'PENDING',
    RUNNING = 'RUNNING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

export interface IAgentTask {
    userId: string;
    type: AgentTaskType;
    status: AgentTaskStatus;
    inputData: any;
    outputData?: any;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
    startedAt?: Date;
    completedAt?: Date;
}

export type AgentWorkflowResult = {
    status: 'completed' | 'failed' | 'pending';
    result?: any;
    error?: string;
};

export type AgentWorkflow = (task: IAgentTask) => Promise<AgentWorkflowResult>;
