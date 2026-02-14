import * as Sentry from '@sentry/node';
import { Job, Processor, Queue, QueueOptions, Worker, WorkerOptions } from 'bullmq';
import { logger } from '../../config/logger';
import redisConnection from '../../config/redis';
import { MetricsService } from '../../features/monitoring/metrics.service';

export interface IQueueDefinition<T = any> {
    name: string;
    queue: Queue<T>;
    worker?: Worker<T>;
}

export class QueueService {
    private static queues: Map<string, Queue> = new Map();
    private static workers: Map<string, Worker> = new Map();

    /**
     * Register a queue
     * @param name The name of the queue
     * @param options BullMQ Queue options
     */
    static registerQueue<T>(name: string, options?: Omit<QueueOptions, 'connection'>): Queue<T> {
        if (this.queues.has(name)) {
            return this.queues.get(name) as Queue<T>;
        }

        const queue = new Queue<T>(name, {
            connection: redisConnection as any,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
                removeOnComplete: 100, // Keep last 100 completed jobs
                removeOnFail: 200,     // Keep last 200 failed jobs
            },
            ...options,
        });

        this.queues.set(name, queue);
        logger.info(`Queue [${name}] initialized`);

        // Track usage
        MetricsService.increment('redis:queues_initialized');

        return queue;
    }

    /**
     * Register a worker for a queue
     * @param name The name of the queue to process
     * @param processor The job processor function
     * @param options BullMQ Worker options
     */
    static registerWorker<T>(name: string, processor: Processor<T>, options?: Omit<WorkerOptions, 'connection'>): Worker<T> {
        if (this.workers.has(name)) {
            logger.warn(`Worker for queue [${name}] already exists`);
            return this.workers.get(name) as Worker<T>;
        }

        const worker = new Worker<T>(name, processor, {
            connection: redisConnection as any,
            concurrency: 1, // Default to 1 job at a time per worker instance
            ...options,
        });

        worker.on('completed', (job: Job) => {
            logger.info(`Job ${job.id} in queue [${name}] completed`);
        });

        worker.on('failed', (job: Job | undefined, err: Error) => {
            logger.error(`Job ${job?.id} in queue [${name}] failed: ${err.message}`);

            Sentry.withScope((scope) => {
                scope.setTag('queue', name);
                if (job) {
                    scope.setContext('job', {
                        id: job.id,
                        name: job.name,
                        data: job.data,
                    });
                }
                Sentry.captureException(err);
            });
        });

        this.workers.set(name, worker);
        logger.info(`Worker for queue [${name}] started`);
        return worker;
    }

    /**
     * Gracefully close all queues and workers
     */
    static async close() {
        logger.info('Closing all queues and workers...');

        const queueClosePromises = Array.from(this.queues.values()).map((q) => q.close());
        const workerClosePromises = Array.from(this.workers.values()).map((w) => w.close());

        await Promise.all([...queueClosePromises, ...workerClosePromises]);
        logger.info('All queues and workers closed');
    }
}
