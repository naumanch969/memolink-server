import { Queue } from 'bullmq';
import { logger } from '../../config/logger';
import { queueService } from '../../core/queue/queue.service';
import { EnrichmentJobData } from './enrichment.types';

const ENRICHMENT_QUEUE_NAME = 'enrichment-queue';

let enrichmentQueue: Queue<EnrichmentJobData>;

export const initEnrichmentQueue = () => {
    if (enrichmentQueue) return enrichmentQueue;

    enrichmentQueue = queueService.registerQueue<EnrichmentJobData>(ENRICHMENT_QUEUE_NAME, {
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 500 },
        },
    });

    logger.info(`Enrichment Queue '${ENRICHMENT_QUEUE_NAME}' initialized`);
    return enrichmentQueue;
};

export const getEnrichmentQueue = () => {
    if (!enrichmentQueue) {
        return initEnrichmentQueue();
    }
    return enrichmentQueue;
};

export { ENRICHMENT_QUEUE_NAME };
