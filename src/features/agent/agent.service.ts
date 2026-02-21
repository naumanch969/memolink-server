import { agentChatService } from './agent-chat.service';
import { agentNLPService } from './agent-nlp.service';
import { agentSyncService } from './agent-sync.service';
import { agentTaskService } from './agent-task.service';
import { briefingService } from './agent.briefing';
import { IAgentTaskDocument } from './agent.model';
import { AgentTaskType } from './agent.types';

/**
 * AgentService serves as the primary gateway for all AI agent operations.
 * It coordinates Task Management, Natural Language Processing, Chat, and Memory.
 * Logic is delegated to specialized services to maintain Single Responsibility.
 */
export class AgentService {
    /**
     * Task Management
     */
    async createTask(userId: string, type: AgentTaskType, inputData: any): Promise<IAgentTaskDocument> {
        return agentTaskService.createTask(userId, type, inputData);
    }

    async getTask(taskId: string, userId: string): Promise<IAgentTaskDocument | null> {
        return agentTaskService.getTask(taskId, userId);
    }

    async listUserTasks(userId: string, limit = 20): Promise<IAgentTaskDocument[]> {
        return agentTaskService.listUserTasks(userId, limit);
    }

    /**
     * Natural Language Processing
     */
    async processNaturalLanguage(userId: string, text: string, options = {}): Promise<any> {
        return agentNLPService.process(userId, text, options);
    }

    async findSimilarEntries(userId: string, text: string, limit: number = 5): Promise<any[]> {
        return agentNLPService.findSimilarEntries(userId, text, limit);
    }

    /**
     * Conversational Interface
     */
    async chat(userId: string, message: string): Promise<string> {
        return agentChatService.chat(userId, message);
    }

    async goalArchitect(userId: string, message: string, history: Array<{ role: string, content: string }>): Promise<string> {
        return agentChatService.goalArchitect(userId, message, history);
    }

    async clearHistory(userId: string): Promise<void> {
        return agentChatService.clearHistory(userId);
    }

    async getChatHistory(userId: string) {
        return agentChatService.getChatHistory(userId);
    }

    /**
     * Proactive Features
     */
    async getDailyBriefing(userId: string): Promise<string> {
        return briefingService.getDailyBriefing(userId);
    }

    /**
     * Background Synchronization
     */
    async syncEntries(userId: string, entryId?: string): Promise<{ taskId: string }> {
        return agentSyncService.syncEntries(userId, entryId);
    }

    async syncPersona(userId: string, force: boolean = false): Promise<{ taskId: string }> {
        return agentSyncService.syncPersona(userId, force);
    }
}

export const agentService = new AgentService();
export default agentService;
