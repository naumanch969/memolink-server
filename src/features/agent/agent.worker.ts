import { Job } from 'bullmq';
import { logger } from '../../config/logger';
import { QueueService } from '../../core/queue/QueueService';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
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

            // Broadcast status update
            socketService.emitToUser(task.userId, SocketEvents.AGENT_TASK_UPDATED, task);

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

                case AgentTaskType.WEEKLY_ANALYSIS: {
                    const { runWeeklyAnalysis } = await import('./workflows/analysis.workflow');
                    result = await runWeeklyAnalysis(task.userId);
                    break;
                }

                case AgentTaskType.ENTITY_EXTRACTION: {
                    const { runEntityExtraction } = await import('./workflows/extraction.workflow');
                    result = await runEntityExtraction(task);
                    break;
                }

                case AgentTaskType.BRAIN_DUMP: {
                    const { runBrainDump } = await import('./workflows/braindump.workflow');
                    result = await runBrainDump(task);
                    break;
                }

                case AgentTaskType.EMBED_ENTRY: {
                    const { runEntryEmbedding } = await import('./workflows/embedding.workflow');
                    result = await runEntryEmbedding(task);
                    break;
                }

                case AgentTaskType.WEB_ACTIVITY_SUMMARY: {
                    const { runWebActivitySummary } = await import('./workflows/activity.workflow');
                    result = await runWebActivitySummary(task.userId, task.inputData);
                    break;
                }

                case AgentTaskType.SYNC: {
                    const { runSyncWorkflow } = await import('./workflows/sync.workflow');
                    result = await runSyncWorkflow(task.userId, task.inputData);
                    break;
                }

                case AgentTaskType.PERSONA_SYNTHESIS: {
                    const { runPersonaSynthesis } = await import('./workflows/persona.workflow');
                    result = await runPersonaSynthesis(task.userId, task.inputData);
                    break;
                }

                case AgentTaskType.MEMORY_FLUSH: {
                    const { runMemoryFlush } = await import('./workflows/memory.workflow');
                    result = await runMemoryFlush(task);
                    break;
                }

                case AgentTaskType.ENTITY_CONSOLIDATION: {
                    const { runEntityConsolidation } = await import('./workflows/consolidation.workflow');
                    result = await runEntityConsolidation(task);
                    break;
                }

                case AgentTaskType.RETROACTIVE_LINKING: {
                    const { runRetroactiveLinking } = await import('./workflows/linking.workflow');
                    result = await runRetroactiveLinking(task);
                    break;
                }

                case AgentTaskType.COGNITIVE_CONSOLIDATION: {
                    const { runCognitiveConsolidation } = await import('./workflows/consolidation.workflow');
                    result = await runCognitiveConsolidation(task);
                    break;
                }

                case AgentTaskType.MONTHLY_ANALYSIS: {
                    const { runMonthlyAnalysis } = await import('./workflows/monthly-analysis.workflow');
                    result = await runMonthlyAnalysis(task.userId);
                    break;
                }

                // Synchronous / No-op tasks
                case AgentTaskType.REMINDER_CREATE:
                case AgentTaskType.GOAL_CREATE:
                case AgentTaskType.KNOWLEDGE_QUERY:
                case AgentTaskType.DAILY_BRIEFING:
                    result = { processed: true, sync: true };
                    break;

                default:
                    throw new Error(`Unknown agent task type: ${task.type}`);
            }

            // Update status to COMPLETED
            task.outputData = result;
            task.status = AgentTaskStatus.COMPLETED;
            task.completedAt = new Date();
            await task.save();
            logger.info(`Agent Task Completed: ${taskId}`);

            // Broadcast status update
            socketService.emitToUser(task.userId, SocketEvents.AGENT_TASK_UPDATED, task);

            // Trigger Report Creation for Analysis Tasks
            if (task.type === AgentTaskType.WEEKLY_ANALYSIS || task.type === AgentTaskType.MONTHLY_ANALYSIS) {
                try {
                    const { reportService } = await import('../report/report.service');
                    await reportService.createFromTask(task.userId, task._id.toString());
                } catch (reportError) {
                    logger.error(`Failed to create report from task ${taskId}`, reportError);
                    // We don't fail the task itself, but we log the error
                }
            }

        } catch (error: any) {
            logger.error(`Agent Task Failed: ${taskId}`, error);
            task.status = AgentTaskStatus.FAILED;
            task.error = error.message || 'Unknown error';
            await task.save();

            // Broadcast status update
            socketService.emitToUser(task.userId, SocketEvents.AGENT_TASK_UPDATED, task);

            throw error; // Rethrow to let BullMQ handle retries if configured
        }
    });
};
