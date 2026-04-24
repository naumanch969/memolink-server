import { Queue } from 'bullmq';
import { logger } from '../../config/logger';
import { queueService } from '../../core/queue/queue.service';
import { MEDIA_JOB_OPTIONS, MEDIA_QUEUE_NAME, MEDIA_JOB_PROCESS } from '../../core/queue/queue.constants';
import { MediaJobData, MediaJobType } from './media.types';

let mediaQueue: Queue<MediaJobData>;

// Initialize the Media Processing Queue
export const initMediaQueue = () => {
    if (mediaQueue) return mediaQueue;

    mediaQueue = queueService.registerQueue<MediaJobData>(MEDIA_QUEUE_NAME, {
        defaultJobOptions: MEDIA_JOB_OPTIONS,
    });

    logger.info(`[Media Queue] Initialized: ${MEDIA_QUEUE_NAME}`);
    return mediaQueue;
};

// Get context-specific media queue
export const getMediaQueue = () => {
    if (!mediaQueue) return initMediaQueue();
    return mediaQueue;
};

// Utility to add media processing jobs
export const addMediaJob = async (data: MediaJobData) => {
    const queue = getMediaQueue();

    // Standardized job name pattern
    const jobName = `${MEDIA_JOB_PROCESS}:${data.jobType}:${data.mediaId || 'background'}`;

    const job = await queue.add(jobName, data);

    logger.info(`[Media Queue] Job added: ${jobName}`, { jobId: job.id, type: data.jobType, source: data.sourceType });
    return job;
};

export { MediaJobType };
