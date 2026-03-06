import { Queue } from 'bullmq';
import { logger } from '../../config/logger';
import { queueService } from '../../core/queue/queue.service';
import { EnrichmentJobData } from './enrichment.types';

export const ENRICHMENT_QUEUE_NAME = 'enrichment-queue';

export let enrichmentQueue: Queue<EnrichmentJobData>;

export const initEnrichmentQueue = () => {
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
        initEnrichmentQueue();
    }
    return enrichmentQueue;
};
