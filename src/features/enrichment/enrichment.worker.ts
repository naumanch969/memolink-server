import { Job } from 'bullmq';
import { logger } from '../../config/logger';
import { queueService } from '../../core/queue/queue.service';
import { ENRICHMENT_QUEUE_NAME, ENRICHMENT_WORKER_CONFIG } from '../../core/queue/queue.constants';
import { initEnrichmentQueue } from './enrichment.queue';
import { enrichmentService } from './enrichment.service';
import { EnrichmentJobData } from './enrichment.types';

const processJob = async (job: Job<EnrichmentJobData>) => {
    const { userId, sourceType, referenceId, sessionId, signalTier } = job.data;

    try {
        if (sourceType === 'active' && referenceId) {
            await enrichmentService.processActiveEnrichment(userId, referenceId, sessionId, signalTier);
        } else if (sourceType === 'passive') {
            await enrichmentService.processPassiveEnrichment(userId, sessionId);
        } else {
            logger.warn(`Enrichment worker: unknown sourceType or missing referenceId [sourceType=${sourceType}]`);
        }
    } catch (error: any) {
        logger.error(`Enrichment job ${job.id} failed`, error);
        throw error;
    }
};

export const initEnrichmentWorker = () => {
    initEnrichmentQueue();

    const worker = queueService.registerWorker<EnrichmentJobData>(
        ENRICHMENT_QUEUE_NAME,
        processJob,
        ENRICHMENT_WORKER_CONFIG,
    );

    worker.on('failed', (job, err) => {
        logger.error(`Enrichment job ${job?.id} failed permanently`, err);
    });

    logger.info('Enrichment Worker initialized');
    return worker;
};
