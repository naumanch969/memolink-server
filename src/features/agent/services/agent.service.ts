import { Types } from 'mongoose';
import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/llm.service';
import { socketService } from '../../../core/socket/socket.service';
import { SocketEvents } from '../../../core/socket/socket.types';
import DateUtil from '../../../shared/utils/date.utils';
import { Entry } from '../../entry/entry.model';
import { entryService } from '../../entry/entry.service';
import { goalService } from '../../goal/goal.service';
import { graphService } from '../../graph/graph.service';
import reminderService from '../../reminder/reminder.service';
import webActivityService from '../../web-activity/web-activity.service';
import { AGENT_CONSTANTS } from '../agent.constants';
import { IAgentService } from '../agent.interfaces';
import { AgentTask, IAgentTaskDocument } from '../agent.model';
import { getAgentQueue } from '../agent.queue';
import { AgentTaskInput, AgentTaskStatus, AgentTaskType } from '../agent.types';
import { agentMemoryService } from '../memory/agent.memory';
import { IUserPersonaDocument, UserPersona } from '../memory/persona.model';
import { chatOrchestrator } from '../orchestrators/chat.orchestrator';
export class AgentService implements IAgentService {
    /**
     * ==========================================
     * TASK MANAGEMENT
     * ==========================================
     */

    async createTask(userId: string | Types.ObjectId, type: AgentTaskType, inputData: AgentTaskInput): Promise<IAgentTaskDocument> {
        const task = await AgentTask.create({
            userId,
            type,
            status: AgentTaskStatus.PENDING,
            inputData,
        });

        try {
            const queue = getAgentQueue();
            await queue.add(type, { taskId: task._id.toString() });
            logger.info(`Agent Task enqueued: [${type}] ${task._id} for user ${userId}`);

            // Notify frontend immediately that a task is enqueued
            socketService.emitToUser(userId, SocketEvents.AGENT_TASK_UPDATED, task);
        } catch (error) {
            logger.error('Failed to enqueue agent task', error);
            task.status = AgentTaskStatus.FAILED;
            task.error = 'Failed to enqueue task';
            await task.save();
            socketService.emitToUser(userId, SocketEvents.AGENT_TASK_UPDATED, task);
        }

        return task;
    }

    async getTask(taskId: string, userId: string): Promise<IAgentTaskDocument | null> {
        return AgentTask.findOne({ _id: taskId, userId });
    }

    async listUserTasks(userId: string, limit = 20): Promise<IAgentTaskDocument[]> {
        return AgentTask.find({ userId }).sort({ createdAt: -1 }).limit(limit);
    }

    /**
     * ==========================================
     * NATURAL LANGUAGE PROCESSING
     * ==========================================
     */

    async processNaturalLanguage(userId: string, text: string, options: any = {}): Promise<any> {
        // 1. Reliability Pattern: Capture to Library first
        let entry: any = null;
        try {
            entry = await entryService.createEntry(userId, {
                content: text,
                date: new Date(),
                type: 'text',
                status: 'processing', // Start in processing since it's an AI flow
                tags: options.tags || [],
                metadata: { source: options.source || 'capture-mode' }
            });
            logger.info("Reliability Capture: Entry saved", { userId, entryId: entry._id });
        } catch (error) {
            logger.error("Reliability Capture Failed", error);
            throw error;
        }

        try {
            // Keep user history updated
            await agentMemoryService.addMessage(userId, 'user', text);

            // 2. Trigger Unified Enrichment Task
            // This task now handles Tagging, Extraction, and Indexing in background.
            const task = await this.createTask(userId, AgentTaskType.ENTRY_ENRICHMENT, {
                text,
                entryId: entry._id.toString(),
                options: { timezone: options.timezone }
            });

            const summary = "Processing your entry...";
            await agentMemoryService.addMessage(userId, 'agent', summary);

            // Background Persona Sync
            this.triggerSynthesis(userId).catch(err => logger.error("Persona Synthesis trigger failed", err));

            return {
                tasks: [task],
                result: entry,
                summary
            };

        } catch (error) {
            logger.error("Agent NLP Processing failed", error);
            if (entry?._id) {
                await entryService.updateEntry(entry._id.toString(), userId, { status: 'failed' });
            }
            throw error;
        }
    }

    async findSimilarEntries(userId: string, text: string, limit: number = 5): Promise<any[]> {
        try {
            const queryVector = await LLMService.generateEmbeddings(text, { workflow: 'similarity', userId });
            const results = await Entry.aggregate([
                {
                    $vectorSearch: {
                        index: "vector_index",
                        path: "embeddings",
                        queryVector,
                        numCandidates: 100,
                        limit,
                        filter: { userId: new Types.ObjectId(userId) }
                    }
                },
                { $project: { content: 1, date: 1, type: 1, score: { $meta: "vectorSearchScore" } } }
            ]);

            if (results.length > 0) return results;

            const { entries } = await entryService.getEntries(userId, { q: text, limit });
            return (entries || []).map((e: any) => ({ content: e.content, date: e.date, type: e.type, score: 0.5 }));
        } catch (error) {
            logger.error('Similar entries lookup failed', error);
            return [];
        }
    }

    async cleanText(userId: string, text: string): Promise<string> {
        try {
            const prompt = `Clean raw/fragmented text into polished format while preserving meaning, tone, tags, and mentions.\nInput: "${text}"\nCleaned Text:`;
            return (await LLMService.generateText(prompt, { workflow: 'text_cleaning', userId, temperature: 0.3 })).trim();
        } catch (error) {
            logger.error('Text cleaning failed', error);
            return text;
        }
    }

    /**
     * ==========================================
     * CONVERSATIONAL INTERFACE
     * ==========================================
     */

    async chat(userId: string, message: string): Promise<string> {
        await agentMemoryService.addMessage(userId, 'user', message);
        return await chatOrchestrator.chat(userId, message, {
            onFinish: async (finalAnswer) => {
                await agentMemoryService.addMessage(userId, 'agent', finalAnswer);
                this.triggerSynthesis(userId).catch(e => logger.error("Persona Synthesis trigger failed", e));
                this.checkMemoryFlush(userId).catch(e => logger.error("Memory Flush check failed", e));
            }
        });
    }

    async goalArchitect(userId: string, message: string, history: Array<{ role: string, content: string }>): Promise<string> {
        const historyText = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
        const prompt = `You are a Goal Architect AI. Help the user operationalize ambitions into Goals.\nHistory: ${historyText}\nUSER: ${message}`;
        return await LLMService.generateText(prompt, { workflow: 'goal_architect', userId });
    }

    async clearHistory(userId: string): Promise<void> {
        await agentMemoryService.clear(userId);
    }

    async getChatHistory(userId: string) {
        return await agentMemoryService.getHistory(userId);
    }

    private async checkMemoryFlush(userId: string) {
        const history = await agentMemoryService.getHistory(userId);
        if (history.length >= AGENT_CONSTANTS.FLUSH_THRESHOLD) {
            await this.createTask(userId, AgentTaskType.MEMORY_FLUSH, { count: AGENT_CONSTANTS.FLUSH_COUNT });
            await this.createTask(userId, AgentTaskType.COGNITIVE_CONSOLIDATION, { messageCount: AGENT_CONSTANTS.FLUSH_COUNT });
        }
    }

    /**
     * ==========================================
     * PROACTIVE FEATURES & PERSONA
     * ==========================================
     */

    async getDailyBriefing(userId: string): Promise<string> {
        try {
            const now = new Date();
            const startOfDay = new Date(now).setHours(0, 0, 0, 0);

            const existingTask = await AgentTask.findOne({
                userId, type: AgentTaskType.DAILY_BRIEFING,
                createdAt: { $gte: startOfDay },
                status: AgentTaskStatus.COMPLETED
            });

            if (existingTask?.outputData?.text) return existingTask.outputData.text;

            const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
            const [entriesData, upcoming, overdue, goals, webActivity, pendingProposals] = await Promise.all([
                entryService.getEntries(userId, { dateFrom: twoDaysAgo.toISOString(), limit: 5 }),
                reminderService.getUpcomingReminders(userId, 15),
                reminderService.getOverdueReminders(userId),
                goalService.getGoals(userId, {}),
                webActivityService.getTodayStats(userId, DateUtil.getYesterdayDateKey()),
                graphService.getPendingProposals(userId)
            ]);

            const entries = entriesData.entries || [];
            const prompt = `You are a Chief of Staff AI. provide a structured daily briefing.\nDATA: \nLogs: ${entries.length}\nReminders: ${upcoming.length}\nGoals: ${goals.length}\nWeb Activity: ${webActivity?.totalSeconds || 0}s`;

            const briefingText = await LLMService.generateText(prompt, { workflow: 'daily_briefing', userId });

            await AgentTask.create({
                userId, type: AgentTaskType.DAILY_BRIEFING, status: AgentTaskStatus.COMPLETED,
                completedAt: new Date(), outputData: { text: briefingText }
            });

            return briefingText;
        } catch (error) {
            logger.error('Failed to generate daily briefing', error);
            return "Good morning. I was unable to compile your full briefing.";
        }
    }

    async getPersona(userId: string | Types.ObjectId): Promise<IUserPersonaDocument> {
        let persona = await UserPersona.findOne({ userId });
        if (!persona) {
            persona = await UserPersona.create({ userId, summary: 'Synthesizing...', rawMarkdown: '# Persona Loading...', lastSynthesized: new Date() });
        }
        return persona;
    }

    async updatePersona(userId: string | Types.ObjectId, data: Partial<IUserPersonaDocument>): Promise<IUserPersonaDocument> {
        const persona = await UserPersona.findOneAndUpdate(
            { userId },
            { $set: data },
            { new: true, upsert: true }
        );
        return persona;
    }

    async triggerSynthesis(userId: string | Types.ObjectId, force: boolean = false): Promise<void> {
        const persona = await this.getPersona(userId);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (!force && persona.lastSynthesized > oneDayAgo && persona.rawMarkdown.length > 100) return;
        await this.createTask(userId, AgentTaskType.PERSONA_SYNTHESIS, { force });
    }

    async getPersonaContext(userId: string): Promise<string> {
        const persona = await this.getPersona(userId);
        return `USER PERSONA SOURCE OF TRUTH:\n${persona.rawMarkdown}\nSummary: ${persona.summary}`;
    }

    async syncEntries(userId: string, entryId?: string): Promise<{ taskId: string }> {
        const task = await this.createTask(userId, AgentTaskType.SYNC, { entryId });
        return { taskId: task._id.toString() };
    }

    async syncPersona(userId: string, force: boolean = false): Promise<{ taskId: string }> {
        const task = await this.createTask(userId, AgentTaskType.PERSONA_SYNTHESIS, { force });
        return { taskId: task._id.toString() };
    }
}

export const agentService = new AgentService();
export default agentService;
