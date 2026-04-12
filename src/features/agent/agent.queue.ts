import { Queue } from 'bullmq';
import { logger } from '../../config/logger';
import { queueService } from '../../core/queue/queue.service';
import { AGENT_JOB_OPTIONS, AGENT_QUEUE_NAME } from '../../core/queue/queue.constants';

let agentQueue: Queue;

export const initAgentQueue = () => {
    agentQueue = queueService.registerQueue(AGENT_QUEUE_NAME, {
        defaultJobOptions: AGENT_JOB_OPTIONS,
    });
    logger.info(`Agent Queue '${AGENT_QUEUE_NAME}' initialized`);
    return agentQueue;
};

export const getAgentQueue = () => {
    if (!agentQueue) return initAgentQueue();
    return agentQueue;
};
