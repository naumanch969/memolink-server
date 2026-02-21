import { logger } from '../../config/logger';
import { agentTaskService } from './agent-task.service';
import { AgentTaskType } from './agent.types';

export class AgentSyncService {
    /**
     * Retroactively syncs/refines entries for consistency
     */
    async syncEntries(userId: string, entryId?: string): Promise<{ taskId: string }> {
        const task = await agentTaskService.createTask(userId, AgentTaskType.SYNC, {
            entryId
        });

        logger.info(`Library sync request initiated for user ${userId}. TaskId: ${task._id}`);
        return { taskId: task._id.toString() };
    }

    /**
     * Triggers a deep persona synthesis for the user
     */
    async syncPersona(userId: string, force: boolean = false): Promise<{ taskId: string }> {
        const task = await agentTaskService.createTask(userId, AgentTaskType.PERSONA_SYNTHESIS, { force });
        logger.info(`Persona sync initiated for user ${userId}. TaskId: ${task._id}`);
        return { taskId: task._id.toString() };
    }
}

export const agentSyncService = new AgentSyncService();
