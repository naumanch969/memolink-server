import { Job } from 'bullmq';
import { logger } from '../../config/logger';
import { queueService } from '../../core/queue/queue.service';
import { ENRICHMENT_JOB_ACTIVE, ENRICHMENT_JOB_PASSIVE, ENRICHMENT_QUEUE_NAME, ENRICHMENT_WORKER_CONFIG } from '../../core/queue/queue.constants';
import { initEnrichmentQueue } from './enrichment.queue';
import { enrichmentService } from './enrichment.service';
import { EnrichmentJobData } from './enrichment.types';

const processJob = async (job: Job<EnrichmentJobData>) => {
    const { userId, sourceType, referenceId, sessionId, signalTier } = job.data;
    
    // Using logger instead of console.log for consistent logging across server and worker
    logger.info(`[Enrichment Worker] Job ${job.id} picked up for execution | Entry: ${referenceId}`);
    logger.debug(`[Enrichment Worker] Job Data:`, job.data);

    try {
        if (job.name === ENRICHMENT_JOB_ACTIVE || sourceType === 'active') {
            if (!referenceId) throw new Error(`Missing referenceId for active enrichment job ${job.id}`);
            await enrichmentService.processActiveEnrichment(userId, referenceId, sessionId, signalTier);
        } else if (job.name === ENRICHMENT_JOB_PASSIVE || sourceType === 'passive') {
            await enrichmentService.processPassiveEnrichment(userId, sessionId);
        } else {
            logger.warn(`[Enrichment Worker] Unknown job name [${job.name}] or sourceType [${sourceType}] for job ${job.id}`);
        }
    } catch (error: any) {
        logger.error(`[Enrichment Worker] Job ${job.id} failed:`, error);
        throw error; // Let BullMQ handle retries
    }
};

export const initEnrichmentWorker = () => {
    initEnrichmentQueue();

    const worker = queueService.registerWorker<EnrichmentJobData>(
        ENRICHMENT_QUEUE_NAME,
        processJob,
        ENRICHMENT_WORKER_CONFIG,
    );

    worker.on('active', (job) => {
        logger.info(`[Enrichment Worker] Job ${job.id} started processing`);
    });

    worker.on('completed', (job) => {
        logger.info(`[Enrichment Worker] Job ${job.id} completed successfully`);
    });

    worker.on('failed', (job, err) => {
        logger.error(`[Enrichment Worker] Job ${job?.id} failed permanently: ${err.message}`, err);
    });

    worker.on('error', (err) => {
        logger.error(`[Enrichment Worker] Fatal error in worker: ${err.message}`, err);
    });

    worker.on('stalled', (jobId) => {
        logger.warn(`[Enrichment Worker] Job ${jobId} stalled! This usually means the event loop was blocked or the lock expired.`);
    });

    // Log initial counts for visibility
    logger.info(`[Enrichment Worker] Registered for queue: ${ENRICHMENT_QUEUE_NAME}`);

    // Clean Startup Protocol
    (async () => {
        try {
            const queue = initEnrichmentQueue();
            
            // Remove existing waiting/active jobs to ensure fresh start
            // FIXED: drain(true) is too aggressive and was likely wiping jobs enqueued during server initialization
            // await queue.drain(true);
            logger.info('[Enrichment Worker] Enrichment Queue initialized');

            // Trigger healing logic to re-enqueue any entries that were left in weird states
            // We wait a second to ensure workers are ready
            setTimeout(async () => {
                logger.info('[Enrichment Worker] Triggering immediate enrichment healing...');
                await enrichmentService.runEnrichmentHealingBatch().catch(err => {
                    logger.error('[Enrichment Worker] Enrichment healing failed:', err);
                });
            }, 3000);

        } catch (error) {
            logger.error('[Enrichment Worker] Startup initialization failed:', error);
        }
    })();

    return worker;
};
