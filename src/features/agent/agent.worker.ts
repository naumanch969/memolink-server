import { Job } from 'bullmq';
import { logger } from '../../config/logger';
import { AGENT_QUEUE_NAME, AGENT_WORKER_CONFIG } from '../../core/queue/queue.constants';
import { queueService } from '../../core/queue/queue.service';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import reportService from '../report/report.service';
import { AgentTask, IAgentTaskDocument } from './agent.model';
import { AgentTaskStatus, AgentTaskType, AgentWorkflowResult, WorkflowStatus } from './agent.types';
import { agentWorkflowRegistry } from './agent.workflow.registry';
import { cognitiveConsolidationWorkflow, entityConsolidationWorkflow } from './workflows/consolidation.workflow';
import { retroactiveLinkingWorkflow } from './workflows/linking.workflow';
import { memoryFlushWorkflow } from './workflows/memory.workflow';
import { monthlyAnalysisWorkflow } from './workflows/monthly-analysis.workflow';
import { personaWorkflow } from './workflows/persona.workflow';
import { syncWorkflow } from './workflows/sync.workflow';
import { webActivityWorkflow } from './workflows/web-activity.workflow';
import { weeklyAnalysisWorkflow } from './workflows/weekly-analysis.workflow';

/**
 * Tracks active tasks to allow for external cancellation.
 */
const activeControllers = new Map<string, AbortController>();

/**
 * Cancels a running task locally if it exists in this worker's active map.
 */
export const cancelActiveTask = (taskId: string): boolean => {
    const controller = activeControllers.get(taskId);
    if (controller) {
        controller.abort('Task cancelled by user');
        return true;
    }
    return false;
};

/**
 * AGENT WORKFLOW REGISTRATION
 * Maps task types to their respective execution logic.
 * Uses dynamic imports to keep worker startup light.
 */
const registerWorkflows = () => {
    const registry = agentWorkflowRegistry;

    // To generate weekly analysis
    registry.register({
        type: AgentTaskType.WEEKLY_ANALYSIS,
        execute: (task, emit, signal) => weeklyAnalysisWorkflow.execute(task, emit, signal)
    });

    // To generate monthly analysis
    registry.register({
        type: AgentTaskType.MONTHLY_ANALYSIS,
        execute: (task, emit, signal) => monthlyAnalysisWorkflow.execute(task, emit, signal)
    });

    // To generate web activity summary
    registry.register({
        type: AgentTaskType.WEB_ACTIVITY_SUMMARY,
        execute: (task, emit, signal) => webActivityWorkflow.execute(task, emit, signal)
    });

    // To sync entries, execute all pending AgentTasks (retrieved from DB)
    registry.register({
        type: AgentTaskType.SYNC,
        execute: (task, emit, signal) => syncWorkflow.execute(task, emit, signal)
    });

    // To update user persona
    registry.register({
        type: AgentTaskType.PERSONA_SYNTHESIS,
        execute: (task, emit, signal) => personaWorkflow.execute(task, emit, signal)
    });

    // Memory Flush
    registry.register({
        type: AgentTaskType.MEMORY_FLUSH,
        execute: (task, emit, signal) => memoryFlushWorkflow.execute(task, emit, signal)
    });

    // To update entity (people, places, organizations, etc.) summaries 
    registry.register({
        type: AgentTaskType.ENTITY_CONSOLIDATION,
        execute: (task, emit, signal) => entityConsolidationWorkflow.execute(task, emit, signal)
    });

    // Retroactive linking
    registry.register({
        type: AgentTaskType.RETROACTIVE_LINKING,
        execute: (task, emit, signal) => retroactiveLinkingWorkflow.execute(task, emit, signal)
    });

    // Cognitive consolidation
    registry.register({
        type: AgentTaskType.COGNITIVE_CONSOLIDATION,
        execute: (task, emit, signal) => cognitiveConsolidationWorkflow.execute(task, emit, signal)
    });

    // Simple / Sync tasks that don't need a formal workflow file yet
    const syncNoOp = async () => ({ status: WorkflowStatus.COMPLETED, result: { processed: true, sync: true } } as AgentWorkflowResult);
    [
        AgentTaskType.REMINDER_CREATE,
        AgentTaskType.GOAL_CREATE,
        AgentTaskType.KNOWLEDGE_QUERY,
        AgentTaskType.DAILY_BRIEFING,
        AgentTaskType.DAILY_REFLECTION
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

        const controller = new AbortController();
        activeControllers.set(taskId, controller);

        try {
            await updateTaskStatus(task, AgentTaskStatus.RUNNING);

            if (!agentWorkflowRegistry.hasWorkflow(task.type)) {
                throw new Error(`No workflow registered for task type: ${task.type}`);
            }

            const workflow = agentWorkflowRegistry.getWorkflow(task.type);

            // Progress Emitter for high-fidelity updates
            const emitProgress = async (step: string, meta?: any) => {
                task.currentStep = step;
                if (meta) {
                    task.stats = { ...task.stats, ...meta };
                }
                await task.save();
                socketService.emitToUser(task.userId, SocketEvents.AGENT_TASK_UPDATED, task);
            };

            const result = await workflow.execute(task, emitProgress, controller.signal);

            if (result.status === WorkflowStatus.FAILED) {
                await handleTaskFailure(task, new Error(result.error || 'Workflow failed'));
            } else {
                await finalizeTask(task, result.result);
                await postProcessTask(task);
            }

        } catch (error: any) {
            await handleTaskFailure(task, error);
            throw error;
        } finally {
            activeControllers.delete(taskId);
        }
    }, AGENT_WORKER_CONFIG);
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
    socketService.emitToUser(task.userId.toString(), SocketEvents.AGENT_TASK_UPDATED, task);
}

async function handleTaskFailure(task: IAgentTaskDocument, error: any) {
    logger.error(`Agent Task Failed: ${task._id} [${task.type}]`, error);
    task.status = AgentTaskStatus.FAILED;
    task.error = error.message || 'Unknown error';
    await task.save();
    socketService.emitToUser(task.userId.toString(), SocketEvents.AGENT_TASK_UPDATED, task);
}

async function postProcessTask(task: IAgentTaskDocument) {
    // 2. Trigger Report Creation for Analysis Tasks
    if (task.type === AgentTaskType.WEEKLY_ANALYSIS || task.type === AgentTaskType.MONTHLY_ANALYSIS) {
        try {
            await reportService.createFromTask(task.userId, task._id.toString());
        } catch (reportError) {
            logger.error(`Failed to create report from task ${task._id}`, reportError);
        }
    }
}

