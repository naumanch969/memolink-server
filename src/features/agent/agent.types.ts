export enum AgentTaskType {
    DAILY_REFLECTION = 'DAILY_REFLECTION',
    WEEKLY_ANALYSIS = 'WEEKLY_ANALYSIS',
    ENTRY_TAGGING = 'ENTRY_TAGGING',
    PEOPLE_EXTRACTION = 'PEOPLE_EXTRACTION',
    LINKEDIN_PROFILE_PARSE = 'LINKEDIN_PROFILE_PARSE',
    BRAIN_DUMP = 'BRAIN_DUMP',
    ROUTINE_CREATE = 'ROUTINE_CREATE',
    CHECKLIST_CREATE = 'CHECKLIST_CREATE',
    REMINDER_CREATE = 'REMINDER_CREATE',
    REMINDER_UPDATE = 'REMINDER_UPDATE',
    GOAL_CREATE = 'GOAL_CREATE',
    DAILY_BRIEFING = 'DAILY_BRIEFING',
    EMBED_ENTRY = 'EMBED_ENTRY',
    KNOWLEDGE_QUERY = 'KNOWLEDGE_QUERY',
    WEB_ACTIVITY_SUMMARY = 'WEB_ACTIVITY_SUMMARY',
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
