import { Job, Worker } from 'bullmq';
import { logger } from '../../config/logger';
import { queueService } from '../../core/queue/queue.service';
import { MEDIA_QUEUE_NAME, MEDIA_WORKER_CONFIG } from '../../core/queue/queue.constants';
import { MediaJobData, MediaJobType } from './media.types';
import { processAudio } from './workers/audio.processor';
import { processImage } from './workers/image.processor';
import { processDocument } from './workers/document.processor';
import { processVideo } from './workers/video.processor';
import { initMediaQueue } from './media.queue';


// Main job processor for media tasks
const processJob = async (job: Job<MediaJobData>) => {
    const { jobType, mediaId, userId, sourceType } = job.data;

    logger.info(`[Media Worker] Job ${job.id} picked up for execution | Type: ${jobType} | Media: ${mediaId}`);
    logger.debug(`[Media Worker] Job Data:`, job.data);

    try {
        switch (jobType) {
            case MediaJobType.PROCESS_AUDIO:
                logger.info(`[Media Worker] Starting audio processing | Source: ${sourceType}`);
                await processAudio(job.data);
                break;

            case MediaJobType.PROCESS_IMAGE:
                logger.info(`[Media Worker] Starting image processing | Source: ${sourceType}`);
                await processImage(job.data);
                break;

            case MediaJobType.PROCESS_DOCUMENT:
                logger.info(`[Media Worker] Starting document processing | Source: ${sourceType}`);
                await processDocument(job.data);
                break;

            case MediaJobType.PROCESS_VIDEO:
                logger.info(`[Media Worker] Starting video processing | Source: ${sourceType}`);
                await processVideo(job.data);
                break;

            default:
                logger.warn(`[Media Worker] Received unknown job type: ${jobType}`);
        }
    } catch (error) {
        logger.error(`[Media Worker] Job ${job.id} failed:`, error);
        throw error; // Re-throw to allow BullMQ retry logic
    }
};


// Initialize the Media Worker
export const initMediaWorker = () => {
    // Ensure queue is initialized
    initMediaQueue();

    // Register Worker
    const worker = queueService.registerWorker<MediaJobData>(
        MEDIA_QUEUE_NAME,
        processJob,
        MEDIA_WORKER_CONFIG
    );

    // Setup Standard Listeners
    const setupWorkerListeners = (w: Worker<MediaJobData>, label: string) => {
        w.on('active', (job) => {
            logger.info(`[${label}] Job ${job.id} started processing`);
        });

        w.on('completed', (job) => {
            logger.info(`[${label}] Job ${job.id} completed successfully`);
        });

        w.on('failed', (job, err) => {
            logger.error(`[${label}] Job ${job?.id} failed permanently: ${err.message}`, err);
        });

        w.on('error', (err) => {
            logger.error(`[${label}] Fatal error in worker: ${err.message}`, err);
        });

        w.on('stalled', (jobId) => {
            logger.warn(`[${label}] Job ${jobId} stalled! Lock expired or event loop blocked.`);
        });
    };

    setupWorkerListeners(worker, 'Media Worker');

    logger.info(`[Media Worker] Registered worker for queue: ${MEDIA_QUEUE_NAME}`);

    return worker;
};
