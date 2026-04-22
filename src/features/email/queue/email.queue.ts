import { Queue } from 'bullmq';
import { queueService } from '../../../core/queue/queue.service';
import { EMAIL_DLQ_JOB_OPTIONS, EMAIL_DLQ_NAME, EMAIL_JOB_OPTIONS, EMAIL_QUEUE_NAME } from '../../../core/queue/queue.constants';
import { EmailJob } from '../interfaces/email-job.interface';

let emailQueue: Queue<EmailJob>;
let emailDLQ: Queue<any>;

export const initEmailQueue = () => {
    emailQueue = queueService.registerQueue(EMAIL_QUEUE_NAME, {
        defaultJobOptions: EMAIL_JOB_OPTIONS,
    });

    emailDLQ = queueService.registerQueue(EMAIL_DLQ_NAME, {
        defaultJobOptions: EMAIL_DLQ_JOB_OPTIONS,
    });

    return emailQueue;
};

export const getEmailQueue = () => {
    if (!emailQueue) initEmailQueue();
    return emailQueue;
};

export const getEmailDLQ = () => {
    if (!emailDLQ) initEmailQueue();
    return emailDLQ;
};
