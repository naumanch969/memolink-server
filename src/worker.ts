import 'apminsight';
import mongoose from 'mongoose';
import { config } from './config/env';
import { logger } from './config/logger';
import redisConnection from './config/redis';
import { queueService } from './core/queue/queue.service';
import { getAgentQueue } from './features/agent/agent.queue';
import { initAgentWorker } from './features/agent/agent.worker';
import { getEmailQueue } from './features/email/queue/email.queue';
import { initEmailWorker } from './features/email/queue/email.worker';
import { getEnrichmentQueue } from './features/enrichment/enrichment.queue';
import { initEnrichmentWorker } from './features/enrichment/enrichment.worker';
import notificationWorker from './features/notification/notification.worker';
// import { graphWorker } from './workers/graph.worker';
import enrichmentService from './features/enrichment/enrichment.service';

// Validate environment variables
if (!config.MONGODB_URI) {
    logger.error('MONGODB_URI is not defined in environment variables');
    process.exit(1);
}

if (!config.REDIS_URL) {
    logger.error('REDIS_URL is not defined in environment variables');
    process.exit(1);
}

async function startWorker() {
    try {
        logger.info('Starting Worker Process...');

        // 1. Connect to MongoDB
        await mongoose.connect(config.MONGODB_URI);
        logger.info('Worker connected to MongoDB');

        // 2. Ensure Redis connection
        // The singleton connects automatically, but we can check status
        redisConnection.on('ready', () => {
            logger.info('Redis connection ready for workers');
        });

        // 3. DEV ONLY: Clear queues on startup to prevent zombie jobs
        if (config.NODE_ENV === 'development') {
            logger.info('Development mode detected: Cleaning queues...');

            const emailQueue = getEmailQueue();
            const agentQueue = getAgentQueue();
            const enrichmentQueue = getEnrichmentQueue();

            // Clear statistics
            const counts = await enrichmentQueue.getJobCounts();
            logger.info('Enrichment Queue Status Before Clear:', counts);

            // drain() clears wait, delayed, and paused
            await emailQueue.drain();
            await agentQueue.drain();
            
            // For enrichment, we want a clean slate in dev to fix lock errors
            // DISABLED: obliterate is too destructive and wipes valid waiting jobs on restart
            // await enrichmentQueue.obliterate({ force: true });
            // logger.info('Enrichment Queue cleanup skipped for safety');
        }

        // 4. Register Workers Here
        initAgentWorker();
        initEmailWorker();
        initEnrichmentWorker();

        // 5. Workers handle their own internal startup protocols (including healing)
        // graphWorker.start();
        notificationWorker.start();

        logger.info('Worker service initialized. Waiting for jobs...');

        // Graceful Shutdown
        const shutdown = async (signal: string) => {
            logger.info(`${signal} received. Shutting down worker...`);
            try {
                await notificationWorker.stop();

                await queueService.close();
                await mongoose.disconnect();
                // Redis connection is shared, but we can disconnect it last
                redisConnection.disconnect();
                logger.info('Worker shutdown complete');
                process.exit(0);
            } catch (err) {
                logger.error('Error during shutdown:', err);
                process.exit(1);
            }
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (error) {
        logger.error('Failed to start worker:', error);
        process.exit(1);
    }
}

startWorker();
