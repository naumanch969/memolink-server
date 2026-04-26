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

    // Use a fixed jobId to allow targeted deletion and deduplication
    const jobId = data.mediaId ? `${data.jobType}-${data.mediaId}` : undefined;

    const job = await queue.add(jobName, data, { jobId });

    logger.info(`[Media Queue] Job added: ${jobName}`, { jobId: job.id, type: data.jobType, source: data.sourceType });
    return job;
};

// Cancel jobs for specific media IDs
export const cancelMediaJobs = async (mediaIds: string[]) => {
    try {
        const queue = getMediaQueue();
        const jobTypes = [MediaJobType.PROCESS_AUDIO, MediaJobType.PROCESS_IMAGE, MediaJobType.PROCESS_DOCUMENT, MediaJobType.PROCESS_VIDEO];
        
        const removePromises: Promise<any>[] = [];
        for (const mediaId of mediaIds) {
            for (const jobType of jobTypes) {
                removePromises.push(queue.remove(`${jobType}-${mediaId}`).catch(() => {}));
            }
        }
        
        await Promise.all(removePromises);
        logger.info(`[Media Queue] Cleaned up jobs for media IDs: ${mediaIds.join(', ')}`);
    } catch (error) {
        logger.error(`[Media Queue] Failed to cancel media jobs:`, error);
    }
};

export { MediaJobType };
