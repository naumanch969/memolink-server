import { Queue } from 'bullmq';
import { QueueService } from '../../../core/queue/QueueService';
import { EmailJob } from './email.types';

export const EMAIL_QUEUE_NAME = 'email-delivery';
export const EMAIL_DLQ_NAME = 'email-delivery-dlq';

export let emailQueue: Queue<EmailJob>;
export let emailDLQ: Queue<any>;

export const initEmailQueue = () => {
    emailQueue = QueueService.registerQueue(EMAIL_QUEUE_NAME, {
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

    // Initialize Dead Letter Queue for permanently failed emails
    emailDLQ = QueueService.registerQueue(EMAIL_DLQ_NAME, {
        defaultJobOptions: {
            removeOnComplete: false, // Keep all DLQ entries
            removeOnFail: false,
        },
    });

    return emailQueue;
};

export const getEmailQueue = () => {
    if (!emailQueue) {
        initEmailQueue();
    }
    return emailQueue;
};

export const getEmailDLQ = () => {
    if (!emailDLQ) {
        initEmailQueue();
    }
    return emailDLQ;
};
