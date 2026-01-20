import { Queue } from 'bullmq';
import { QueueService } from '../../../core/queue/QueueService';
import { EmailJob } from './email.types';

export const EMAIL_QUEUE_NAME = 'email-delivery';

export const emailQueue: Queue<EmailJob> = QueueService.registerQueue(EMAIL_QUEUE_NAME, {
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 2000, // Start with 2s delay, then 4s, 8s, etc.
        },
        removeOnComplete: 1000,
        removeOnFail: 5000,
    },
});
