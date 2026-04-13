import { Queue } from 'bullmq';
import { logger } from '../../config/logger';
import { queueService } from '../../core/queue/queue.service';
import { ENRICHMENT_HEALING_JOB_OPTIONS, ENRICHMENT_JOB_OPTIONS, ENRICHMENT_QUEUE_HEALING, ENRICHMENT_QUEUE_NAME } from '../../core/queue/queue.constants';
import { EnrichmentJobData } from './enrichment.types';

let enrichmentQueue: Queue<EnrichmentJobData>;
let enrichmentHealingQueue: Queue<EnrichmentJobData>;

export const initEnrichmentQueue = () => {
    if (enrichmentQueue) return enrichmentQueue;

    enrichmentQueue = queueService.registerQueue<EnrichmentJobData>(ENRICHMENT_QUEUE_NAME,
        {
            defaultJobOptions: ENRICHMENT_JOB_OPTIONS,
        });

    logger.info(`Enrichment Queue '${ENRICHMENT_QUEUE_NAME}' initialized`);
    return enrichmentQueue;
};

export const getEnrichmentQueue = () => {
    if (!enrichmentQueue) return initEnrichmentQueue();
    return enrichmentQueue;
};

export const initEnrichmentHealingQueue = () => {
    if (enrichmentHealingQueue) return enrichmentHealingQueue;

    enrichmentHealingQueue = queueService.registerQueue<EnrichmentJobData>(ENRICHMENT_QUEUE_HEALING,
        {
            defaultJobOptions: ENRICHMENT_HEALING_JOB_OPTIONS,
        });

    logger.info(`Enrichment Healing Queue '${ENRICHMENT_QUEUE_HEALING}' initialized`);
    return enrichmentHealingQueue;
};

export const getEnrichmentHealingQueue = () => {
    if (!enrichmentHealingQueue) return initEnrichmentHealingQueue();
    return enrichmentHealingQueue;
};
