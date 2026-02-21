import { logger } from '../../config/logger';
import { AgentTask, IAgentTaskDocument } from './agent.model';
import { getAgentQueue } from './agent.queue';
import { AgentTaskStatus, AgentTaskType } from './agent.types';

export class AgentTaskService {
    /**
     * Creates a new agent task, persists it to DB, and enqueues it for background processing
     */
    async createTask(userId: string, type: AgentTaskType, inputData: any): Promise<IAgentTaskDocument> {
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
        } catch (error) {
            logger.error('Failed to enqueue agent task', error);
            task.status = AgentTaskStatus.FAILED;
            task.error = 'Failed to enqueue task';
            await task.save();
        }

        return task;
    }

    /**
     * Retrieves a specific task for a user
     */
    async getTask(taskId: string, userId: string): Promise<IAgentTaskDocument | null> {
        return AgentTask.findOne({ _id: taskId, userId });
    }

    /**
     * Lists recent tasks for a user
     */
    async listUserTasks(userId: string, limit = 20): Promise<IAgentTaskDocument[]> {
        return AgentTask.find({ userId })
            .sort({ createdAt: -1 })
            .limit(limit);
    }
}

export const agentTaskService = new AgentTaskService();
