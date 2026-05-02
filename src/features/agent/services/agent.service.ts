import { Types } from 'mongoose';
import { logger } from '../../../config/logger';
import { llmService } from '../../../core/llm/llm.service';
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
import { AgentTaskInput, AgentTaskStatus, AgentTaskType, MessageRole } from '../agent.types';
import { cancelActiveTask } from '../agent.worker';
import { agentMemoryService } from '../memory/agent.memory';
import { IUserPersonaDocument, UserPersona } from '../memory/persona.model';
import { chatOrchestrator } from '../orchestrators/chat.orchestrator';
export class AgentService implements IAgentService {
    /**
     * ==========================================
     * TASK MANAGEMENT
     * ==========================================
     */

    async createTask(userId: string | Types.ObjectId, type: AgentTaskType, inputData: AgentTaskInput, priority?: number): Promise<IAgentTaskDocument> {
        const task = await AgentTask.create({
            userId,
            type,
            status: AgentTaskStatus.PENDING,
            inputData,
            priority: priority || 10
        });

        try {
            const queue = getAgentQueue();
            await queue.add(type, { taskId: task._id.toString() }, {
                jobId: task._id.toString(),
                priority: task.priority
            });
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

    async cleanupTasksByEntryId(userId: string | Types.ObjectId, entryId: string): Promise<void> {
        try {
            const tasks = await AgentTask.find({ userId, 'inputData.entryId': entryId }).select('_id');
            if (tasks.length === 0) return;

            const queue = getAgentQueue();
            await Promise.all(tasks.map(task => queue.remove(task._id.toString()).catch(() => { })));

            logger.info(`Agent Service: Cleaned up jobs for ${tasks.length} tasks related to entry ${entryId}`);
        } catch (error) {
            logger.error(`Agent Service: Failed to cleanup tasks for entry ${entryId}`, error);
        }
    }

    async getTask(taskId: string, userId: string): Promise<IAgentTaskDocument | null> {
        return AgentTask.findOne({ _id: taskId, userId });
    }

    async listUserTasks(userId: string, limit = 20): Promise<IAgentTaskDocument[]> {
        return AgentTask.find({ userId }).sort({ createdAt: -1 }).limit(limit);
    }

    async cancelTask(taskId: string, userId: string): Promise<boolean> {
        const task = await AgentTask.findOne({ _id: taskId, userId });
        if (!task) return false;

        // If it's already finished, do nothing
        const terminalStatuses = [AgentTaskStatus.COMPLETED, AgentTaskStatus.FAILED, AgentTaskStatus.CANCELLED];
        if (terminalStatuses.includes(task.status)) {
            return false;
        }

        try {
            const queue = getAgentQueue();
            const job = await queue.getJob(taskId);

            if (job) {
                await job.remove();
            }

            // Signal the worker to abort if it's currently running on this node
            cancelActiveTask(taskId);

            task.status = AgentTaskStatus.CANCELLED;
            task.completedAt = new Date();
            await task.save();

            socketService.emitToUser(userId, SocketEvents.AGENT_TASK_UPDATED, task);
            logger.info(`Agent Task Cancelled: ${taskId} for user ${userId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to cancel task ${taskId}`, error);
            return false;
        }
    }

    /**
     * ==========================================
     * CONVERSATIONAL INTERFACE
     * ==========================================
     */

    async chat(userId: string, message: string): Promise<string> {
        await agentMemoryService.addMessage(userId, MessageRole.USER, message);
        return await chatOrchestrator.chat(userId, message, {
            onFinish: async (finalAnswer) => {
                await agentMemoryService.addMessage(userId, MessageRole.AGENT, finalAnswer);
                this.triggerSynthesis(userId).catch(e => logger.error("Persona Synthesis trigger failed", e));
                this.checkMemoryFlush(userId).catch(e => logger.error("Memory Flush check failed", e));
            }
        });
    }

    async chatStream(userId: string, message: string, onChunk: (chunk: string) => void): Promise<string> {
        await agentMemoryService.addMessage(userId, MessageRole.USER, message);

        const finalResponse = await chatOrchestrator.chatStream(userId, message, onChunk);

        // Save full message to history after stream finishes
        await agentMemoryService.addMessage(userId, MessageRole.AGENT, finalResponse);

        // Background housekeeping
        this.triggerSynthesis(userId).catch(e => logger.error("Persona Synthesis trigger failed", e));
        this.checkMemoryFlush(userId).catch(e => logger.error("Memory Flush check failed", e));

        return finalResponse;
    }

    async goalArchitect(userId: string, message: string, history: Array<{ role: MessageRole, content: string }>): Promise<string> {
        const historyText = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
        const prompt = `You are a Goal Architect AI. Help the user operationalize ambitions into Goals.\nHistory: ${historyText}\nUSER: ${message}`;
        return await llmService.generateText(prompt, { workflow: 'goal_architect', userId });
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

            const briefingText = await llmService.generateText(prompt, { workflow: 'daily_briefing', userId });

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

    async syncPersona(userId: string, force: boolean = false): Promise<{ taskId: string }> {
        const task = await this.createTask(userId, AgentTaskType.PERSONA_SYNTHESIS, { force });
        return { taskId: task._id.toString() };
    }
}

export const agentService = new AgentService();
export default agentService;
