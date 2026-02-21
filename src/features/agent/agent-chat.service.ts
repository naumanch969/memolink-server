import { logger } from '../../config/logger';
import { LLMService } from '../../core/llm/llm.service';
import { agentTaskService } from './agent-task.service';
import { AGENT_CONSTANTS } from './agent.constants';
import { agentMemory } from './agent.memory';
import { AgentTaskType } from './agent.types';
import { chatOrchestrator } from './orchestrators/chat.orchestrator';
import { personaService } from './persona.service';

export class AgentChatService {
    /**
     * Main chat interface with memory persistence and tool orchestration
     */
    async chat(userId: string, message: string): Promise<string> {
        await agentMemory.addMessage(userId, 'user', message);

        const response = await chatOrchestrator.chat(userId, message, {
            onFinish: async (finalAnswer) => {
                await agentMemory.addMessage(userId, 'agent', finalAnswer);

                // Background housekeeping
                personaService.triggerSynthesis(userId).catch(err => logger.error("Persona Synthesis trigger failed", err));
                this.checkMemoryFlush(userId).catch(err => logger.error("Memory Flush check failed", err));
            }
        });

        return response;
    }

    /**
     * Specialized conversation mode for architecting new goals
     */
    async goalArchitect(userId: string, message: string, history: Array<{ role: string, content: string }>): Promise<string> {
        const historyText = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

        const prompt = `
        SYSTEM INSTRUCTION:
        You are an expert Goal Architect and Coaching AI. Your role is to help users operationalize their ambitions into concrete Goals.

        CONVERSATION HISTORY:
        ${historyText}
        USER: ${message}

        CONVERSATION STYLE:
        - Be concise and natural, like a human coach.
        - Ask ONE or TWO most critical clarifying questions at a time.
        - MATCH the user's energy.

        PHASE 1: INTELLIGENT DISCOVERY
        Analyze context needed: OUTCOME/VISION, MOTIVATION, OBSTACLES.

        DECISION LOGIC:
        - IF trivial goal: Propose plan immediately.
        - IF broad goal: Ask one narrowing question.
        - IF clear: Propose Draft Plan JSON.

        OUTPUT FORMAT:
        - Plain text for questions.
        - JSON inside triple backticks for plans.
    `;

        return await LLMService.generateText(prompt, { workflow: 'goal_architect', userId });
    }

    /**
     * Checks if conversational memory needs to be consolidated into long-term storage
     */
    private async checkMemoryFlush(userId: string) {
        const history = await agentMemory.getHistory(userId);
        if (history.length >= AGENT_CONSTANTS.FLUSH_THRESHOLD) {
            logger.info(`Memory threshold reached for user ${userId}. Triggering consolidation.`);
            await agentTaskService.createTask(userId, AgentTaskType.MEMORY_FLUSH, { count: AGENT_CONSTANTS.FLUSH_COUNT });
            await agentTaskService.createTask(userId, AgentTaskType.COGNITIVE_CONSOLIDATION, {
                messageCount: AGENT_CONSTANTS.FLUSH_COUNT
            });
        }
    }

    async clearHistory(userId: string): Promise<void> {
        await agentMemory.clear(userId);
    }

    async getChatHistory(userId: string) {
        return await agentMemory.getHistory(userId);
    }
}

export const agentChatService = new AgentChatService();
