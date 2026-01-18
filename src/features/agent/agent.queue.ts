import { Queue } from 'bullmq';
import { logger } from '../../config/logger';
import { QueueService } from '../../core/queue/QueueService';

export const AGENT_QUEUE_NAME = 'agent-tasks';

let agentQueue: Queue;

export const initAgentQueue = () => {
    agentQueue = QueueService.registerQueue(AGENT_QUEUE_NAME);
    logger.info(`Agent Queue '${AGENT_QUEUE_NAME}' initialized`);
    return agentQueue;
};

export const getAgentQueue = () => {
    if (!agentQueue) {
        throw new Error('Agent Queue not initialized. Call initAgentQueue first.');
    }
    return agentQueue;
};
