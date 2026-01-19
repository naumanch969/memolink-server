import { Job } from 'bullmq';
import { logger } from '../../config/logger';
import { QueueService } from '../../core/queue/QueueService';
import { AgentTask } from './agent.model';
import { AGENT_QUEUE_NAME } from './agent.queue';
import { AgentTaskStatus, AgentTaskType } from './agent.types';

interface AgentJobData {
    taskId: string;
}

export const initAgentWorker = () => {
    QueueService.registerWorker<AgentJobData>(AGENT_QUEUE_NAME, async (job: Job<AgentJobData>) => {
        const { taskId } = job.data;
        logger.info(`Processing Agent Task: ${taskId}`);

        const task = await AgentTask.findById(taskId);
        if (!task) {
            logger.error(`Agent Task not found: ${taskId}`);
            return;
        }

        try {
            // Update status to RUNNING
            task.status = AgentTaskStatus.RUNNING;
            task.startedAt = new Date();
            await task.save();

            let result;

            switch (task.type) {
                case AgentTaskType.DAILY_REFLECTION: {
                    const { runDailyReflection } = await import('./workflows/reflection.workflow');
                    result = await runDailyReflection(task.userId, task.inputData);
                    break;
                }

                case AgentTaskType.ENTRY_TAGGING: {
                    const { runEntryTagging } = await import('./workflows/tagging.workflow');
                    result = await runEntryTagging(task.userId, task.inputData);
                    break;
                }

                case AgentTaskType.PEOPLE_EXTRACTION: {
                    const { runPeopleExtraction } = await import('./workflows/extraction.workflow');
                    result = await runPeopleExtraction(task);
                    break;
                }

                case AgentTaskType.BRAIN_DUMP: {
                    const { runBrainDump } = await import('./workflows/braindump.workflow');
                    result = await runBrainDump(task);
                    break;
                }

                default:
                    throw new Error(`Unknown agent task type: ${task.type}`);
            }

            // Update status to COMPLETED
            task.outputData = result;
            task.status = AgentTaskStatus.COMPLETED;
            task.completedAt = new Date();
            await task.save();
            logger.info(`Agent Task Completed: ${taskId}`);

        } catch (error: any) {
            logger.error(`Agent Task Failed: ${taskId}`, error);
            task.status = AgentTaskStatus.FAILED;
            task.error = error.message || 'Unknown error';
            await task.save();
            throw error; // Rethrow to let BullMQ handle retries if configured
        }
    });
};
