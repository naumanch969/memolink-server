import { Types } from 'mongoose';
import { IAgentTaskDocument } from './agent.model';
import { AgentTaskType } from './agent.types';
import { IUserPersonaDocument } from './persona.model';

export interface IAgentService {
    createTask(userId: string | Types.ObjectId, type: AgentTaskType, inputData: any): Promise<IAgentTaskDocument>;
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

