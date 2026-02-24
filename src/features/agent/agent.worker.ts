import { Job } from 'bullmq';
import { logger } from '../../config/logger';
import { queueService } from '../../core/queue/queue.service';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import { AgentTask, IAgentTaskDocument } from './agent.model';
import { AGENT_QUEUE_NAME } from './agent.queue';
import { AgentTaskStatus, AgentTaskType } from './agent.types';
import { agentWorkflowRegistry } from './agent.workflow.registry';
import { intentWorkflow } from './workflows/intent.workflow';
import { weeklyAnalysisWorkflow } from './workflows/analysis.workflow';
import { monthlyAnalysisWorkflow } from './workflows/monthly-analysis.workflow';
import { webActivityWorkflow } from './workflows/web-activity.workflow';
import { syncWorkflow } from './workflows/sync.workflow';
import { personaWorkflow } from './workflows/persona.workflow';
import { memoryFlushWorkflow } from './workflows/memory.workflow';
import { cognitiveConsolidationWorkflow, entityConsolidationWorkflow } from './workflows/consolidation.workflow';
import { retroactiveLinkingWorkflow } from './workflows/linking.workflow';
import { taggingWorkflow } from './workflows/tagging.workflow';
import { entityExtractionWorkflow } from './workflows/extraction.workflow';
import { entryEmbeddingWorkflow } from './workflows/embedding.workflow';
import entryService from '../entry/entry.service';
import reportService from '../report/report.service';

/**
 * AGENT WORKFLOW REGISTRATION
 * Maps task types to their respective execution logic.
 * Uses dynamic imports to keep worker startup light.
 */
const registerWorkflows = () => {
    const registry = agentWorkflowRegistry;

    registry.register({
        type: AgentTaskType.INTENT_PROCESSING,
        execute: (task) => intentWorkflow.execute(task)
    });

    registry.register({
        type: AgentTaskType.WEEKLY_ANALYSIS,
        execute: (task) => weeklyAnalysisWorkflow.execute(task)
    });

    registry.register({
        type: AgentTaskType.MONTHLY_ANALYSIS,
        execute: (task) => monthlyAnalysisWorkflow.execute(task)
    });

    registry.register({
        type: AgentTaskType.WEB_ACTIVITY_SUMMARY,
        execute: (task) => webActivityWorkflow.execute(task)
    });

    registry.register({
        type: AgentTaskType.SYNC,
        execute: (task) => syncWorkflow.execute(task)
    });

    registry.register({
        type: AgentTaskType.PERSONA_SYNTHESIS,
        execute: (task) => personaWorkflow.execute(task)
    });

    registry.register({
        type: AgentTaskType.MEMORY_FLUSH,
        execute: (task) => memoryFlushWorkflow.execute(task)
    });

    registry.register({
        type: AgentTaskType.ENTITY_CONSOLIDATION,
        execute: (task) => entityConsolidationWorkflow.execute(task)
    });

    registry.register({
        type: AgentTaskType.RETROACTIVE_LINKING,
        execute: (task) => retroactiveLinkingWorkflow.execute(task)
    });

    registry.register({
        type: AgentTaskType.COGNITIVE_CONSOLIDATION,
        execute: (task) => cognitiveConsolidationWorkflow.execute(task)
    });

    registry.register({
        type: AgentTaskType.TAGGING,
        execute: (task) => taggingWorkflow.execute(task)
    });

    registry.register({
        type: AgentTaskType.ENTITY_EXTRACTION,
        execute: (task) => entityExtractionWorkflow.execute(task)
    });

    registry.register({
        type: AgentTaskType.ENTRY_EMBEDDING,
        execute: (task) => entryEmbeddingWorkflow.execute(task)
    });

    // Simple / Sync tasks that don't need a formal workflow file yet
    const syncNoOp = async () => ({ processed: true, sync: true });
    [
        AgentTaskType.REMINDER_CREATE,
        AgentTaskType.GOAL_CREATE,
        AgentTaskType.KNOWLEDGE_QUERY,
        AgentTaskType.DAILY_BRIEFING
    ].forEach(type => registry.register({ type, execute: syncNoOp }));
};

interface AgentJobData {
    taskId: string;
}

export const initAgentWorker = () => {
    registerWorkflows();

    queueService.registerWorker<AgentJobData>(AGENT_QUEUE_NAME, async (job: Job<AgentJobData>) => {
        const { taskId } = job.data;
        const task = await AgentTask.findById(taskId);

        if (!task) {
            logger.error(`Agent Task not found: ${taskId}`);
            return;
        }

        try {
            await updateTaskStatus(task, AgentTaskStatus.RUNNING);

            if (!agentWorkflowRegistry.hasWorkflow(task.type)) {
                throw new Error(`No workflow registered for task type: ${task.type}`);
            }

            const workflow = agentWorkflowRegistry.getWorkflow(task.type);
            const result = await workflow.execute(task);

            await finalizeTask(task, result);
            await postProcessTask(task);

        } catch (error: any) {
            await handleTaskFailure(task, error);
            throw error;
        }
    });
};

/**
 * HELPER FUNCTIONS
 */

async function updateTaskStatus(task: IAgentTaskDocument, status: AgentTaskStatus) {
    task.status = status;
    if (status === AgentTaskStatus.RUNNING) task.startedAt = new Date();
    await task.save();
    socketService.emitToUser(task.userId, SocketEvents.AGENT_TASK_UPDATED, task);
}

async function finalizeTask(task: IAgentTaskDocument, result: any) {
    task.outputData = result;
    task.status = AgentTaskStatus.COMPLETED;
    task.completedAt = new Date();
    await task.save();
    logger.info(`Agent Task Completed: ${task._id} [${task.type}]`);
    socketService.emitToUser(task.userId, SocketEvents.AGENT_TASK_UPDATED, task);
}

async function handleTaskFailure(task: IAgentTaskDocument, error: any) {
    logger.error(`Agent Task Failed: ${task._id} [${task.type}]`, error);
    task.status = AgentTaskStatus.FAILED;
    task.error = error.message || 'Unknown error';
    await task.save();
    socketService.emitToUser(task.userId.toString(), SocketEvents.AGENT_TASK_UPDATED, task);

    // Specific cleanup for failed intent processing
    if (task.type === AgentTaskType.INTENT_PROCESSING && task.inputData?.entryId) {
        try {
            const entry = await entryService.getEntryById(task.inputData.entryId, task.userId);
            if (entry && entry.status === 'processing') {
                await entryService.updateEntry(task.inputData.entryId, task.userId, {
                    status: 'failed',
                    metadata: { ...entry.metadata, error: task.error }
                });
            }
        } catch (updateError) {
            logger.error("Failed to mark entry as failed on task error", updateError);
        }
    }
}

async function postProcessTask(task: IAgentTaskDocument) {
    // 1. Mark entry ready if intent processing finished
    if (task.type === AgentTaskType.INTENT_PROCESSING && task.inputData?.entryId) {
        const entry = await entryService.getEntryById(task.inputData.entryId, task.userId);
        if (entry && entry.status !== 'ready' && entry.status !== 'failed') {
            await entryService.updateEntry(task.inputData.entryId, task.userId, { status: 'ready' });
            socketService.emitToUser(task.userId, SocketEvents.ENTRY_UPDATED, entry);
        }
    }

    // 2. Trigger Report Creation for Analysis Tasks
    if (task.type === AgentTaskType.WEEKLY_ANALYSIS || task.type === AgentTaskType.MONTHLY_ANALYSIS) {
        try {
            await reportService.createFromTask(task.userId, task._id.toString());
        } catch (reportError) {
            logger.error(`Failed to create report from task ${task._id}`, reportError);
        }
    }
}

