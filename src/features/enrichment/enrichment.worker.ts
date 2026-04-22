import { Job } from 'bullmq';
import { logger } from '../../config/logger';
import { queueService } from '../../core/queue/queue.service';
import { ENRICHMENT_HEALING_WORKER_CONFIG, ENRICHMENT_JOB_ACTIVE, ENRICHMENT_JOB_HEALING, ENRICHMENT_JOB_PASSIVE, ENRICHMENT_QUEUE_HEALING, ENRICHMENT_QUEUE_NAME, ENRICHMENT_WORKER_CONFIG } from '../../core/queue/queue.constants';
import { initEnrichmentHealingQueue, initEnrichmentQueue } from './enrichment.queue';
import { enrichmentService } from './enrichment.service';
import { EnrichmentJobData, SourceType } from './enrichment.types';

const processJob = async (job: Job<EnrichmentJobData>) => {
    const { userId, sourceType, referenceId, sessionId, signalTier } = job.data;

    logger.info(`[Enrichment Worker] Job ${job.id} picked up for execution | Entry: ${referenceId}`);
    logger.debug(`[Enrichment Worker] Job Data:`, job.data);

    try {
        if (job.name === ENRICHMENT_JOB_ACTIVE || job.name === ENRICHMENT_JOB_HEALING || sourceType === SourceType.ACTIVE) {
            if (!referenceId) throw new Error(`Missing referenceId for enrichment job ${job.id}`);
            await enrichmentService.processActiveEnrichment(userId, referenceId, sessionId, signalTier);
        } else if (job.name === ENRICHMENT_JOB_PASSIVE || sourceType === SourceType.PASSIVE) {
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
    initEnrichmentHealingQueue();

    // 1. Primary Enrichment Worker (Active/Passive Traffic)
    const worker = queueService.registerWorker<EnrichmentJobData>(
        ENRICHMENT_QUEUE_NAME,
        processJob,
        ENRICHMENT_WORKER_CONFIG,
    );

    // 2. Healing Worker (Separate pool for maintenance tasks)
    const healingWorker = queueService.registerWorker<EnrichmentJobData>(
        ENRICHMENT_QUEUE_HEALING,
        processJob,
        ENRICHMENT_HEALING_WORKER_CONFIG,
    );

    const setupWorkerListeners = (w: any, label: string) => {
        w.on('active', (job: any) => {
            logger.info(`[${label}] Job ${job.id} started processing`);
        });

        w.on('completed', (job: any) => {
            logger.info(`[${label}] Job ${job.id} completed successfully`);
        });

        w.on('failed', (job: any, err: any) => {
            logger.error(`[${label}] Job ${job?.id} failed permanently: ${err.message}`, err);
        });

        w.on('error', (err: any) => {
            logger.error(`[${label}] Fatal error in worker: ${err.message}`, err);
        });

        w.on('stalled', (jobId: string) => {
            logger.warn(`[${label}] Job ${jobId} stalled! Lock expired or event loop blocked.`);
        });
    };

    setupWorkerListeners(worker, 'Enrichment Worker');
    setupWorkerListeners(healingWorker, 'Healing Worker');

    logger.info(`[Enrichment Worker] Registered workers for queues: ${ENRICHMENT_QUEUE_NAME}, ${ENRICHMENT_QUEUE_HEALING}`);

    // Clean Startup Protocol
    (async () => {
        try {
            logger.info('[Enrichment Worker] Queues and Workers initialized');

            // Trigger healing logic to re-enqueue any entries that were left in weird states
            setTimeout(() => {
                logger.info('[Enrichment Worker] Triggering immediate enrichment healing...');
                enrichmentService.runEnrichmentHealingBatch().catch(err => {
                    logger.error('[Enrichment Worker] Enrichment healing failed:', err);
                });
            }, 500);

        } catch (error) {
            logger.error('[Enrichment Worker] Startup initialization failed:', error);
        }
    })();

    return worker;
};
