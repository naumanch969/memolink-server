import { Types } from 'mongoose';
import { IAgentTaskDocument } from './agent.model';
import { AgentTaskInput, AgentTaskType } from './agent.types';
import { IUserPersonaDocument } from './memory/persona.model';

export interface IAgentService {
    createTask(userId: string | Types.ObjectId, type: AgentTaskType, inputData: AgentTaskInput): Promise<IAgentTaskDocument>;
    getTask(taskId: string, userId: string): Promise<IAgentTaskDocument | null>;
    listUserTasks(userId: string, limit?: number): Promise<IAgentTaskDocument[]>;
    processNaturalLanguage(userId: string, text: string, options?: any): Promise<any>;
    findSimilarEntries(userId: string, text: string, limit?: number): Promise<any[]>;
    cleanText(userId: string, text: string): Promise<string>;
    chat(userId: string, message: string): Promise<string>;
    goalArchitect(userId: string, message: string, history: Array<{ role: string, content: string }>): Promise<string>;
    clearHistory(userId: string): Promise<void>;
    getChatHistory(userId: string): Promise<any>;
    getDailyBriefing(userId: string): Promise<string>;
    getPersona(userId: string | Types.ObjectId): Promise<IUserPersonaDocument>;
    updatePersona(userId: string, data: Partial<IUserPersonaDocument>): Promise<IUserPersonaDocument>;
    triggerSynthesis(userId: string | Types.ObjectId, force?: boolean): Promise<void>;
    getPersonaContext(userId: string): Promise<string>;
    syncEntries(userId: string, entryId?: string): Promise<{ taskId: string }>;
    syncPersona(userId: string, force?: boolean): Promise<{ taskId: string }>;
}

export interface IAudioTranscriptionService {
    transcribe(
        audioBuffer: Buffer,
        mimeType: string,
        options?: { userId?: string; language?: string }
    ): Promise<{ text: string; confidence: 'high' | 'medium' | 'low' }>;
}

export interface IChatMessage {
    role: 'user' | 'agent' | 'system';
    content: string;
    timestamp: number;
}

export interface IAgentMemoryService {
    addMessage(userId: string | Types.ObjectId, role: 'user' | 'agent' | 'system', content: string): Promise<void>;
    getHistory(userId: string | Types.ObjectId): Promise<IChatMessage[]>;
    clear(userId: string | Types.ObjectId): Promise<void>;
    flush(userId: string | Types.ObjectId, count: number): Promise<void>;
    saveToArchive(userId: string | Types.ObjectId, messages: IChatMessage[]): Promise<void>;
}

export interface IAgentAccountabilityService {
    performDailyAudit(userId: string | Types.ObjectId): Promise<void>;
    checkOverdueTasks(userId: string | Types.ObjectId): Promise<void>;
}

export interface IChatOrchestrator {
    chat(userId: string, message: string, options?: { onFinish?: (answer: string) => Promise<void> }): Promise<string>;
}

export interface IAgentWorkflow {
    type: string;
    execute(task: IAgentTaskDocument): Promise<any>;
}

export interface IAgentWorkflowRegistry {
    register(workflow: IAgentWorkflow): void;
    getWorkflow(type: AgentTaskType): IAgentWorkflow;
    hasWorkflow(type: AgentTaskType): boolean;
}
