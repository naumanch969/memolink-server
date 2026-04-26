import './features/integrations/init';
import 'apminsight';
import mongoose from 'mongoose';
import { config } from './config/env';
import { logger } from './config/logger';
import redisConnection from './config/redis';
import { queueService } from './core/queue/queue.service';
import { initAgentWorker } from './features/agent/agent.worker';
import { initEmailWorker } from './features/email/queue/email.worker';
import { initEnrichmentWorker } from './features/enrichment/enrichment.worker';
import notificationWorker from './features/notification/notification.worker';
import { initMediaWorker } from './features/media/media.worker';

// Validate environment variables
if (!config.MONGODB_URI) {
    logger.error('MONGODB_URI is not defined in environment variables');
    process.exit(1);
}

if (!config.REDIS_URL) {
    logger.error('REDIS_URL is not defined in environment variables');
    process.exit(1);
}


// TODO: see if you need to flush queues in dev
export async function startWorker(isStandalone: boolean = true) {
    try {
        logger.info(`Starting Worker Process (${isStandalone ? 'Standalone' : 'Integrated'})...`);

        if (isStandalone) {
            // 1. Connect to MongoDB (only if standalone, otherwise server handles it)
            await mongoose.connect(config.MONGODB_URI);
            logger.info('Worker connected to MongoDB');

            // 2. Ensure Redis connection
            redisConnection.on('ready', () => {
                logger.info('Redis connection ready for workers');
            });
        }

        // 3. Register Workers
        initAgentWorker();
        initEmailWorker();
        initEnrichmentWorker();
        initMediaWorker();

        // 4. Start active workers
        notificationWorker.start();

        logger.info('Worker service initialized. Waiting for jobs...');

        if (isStandalone) {
            // Graceful Shutdown (only if standalone)
            const shutdown = async (signal: string) => {
                logger.info(`${signal} received. Shutting down worker...`);
                try {
                    await notificationWorker.stop();
                    await queueService.close();
                    await mongoose.disconnect();
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
        }

    } catch (error) {
        logger.error('Failed to start worker:', error);
        if (isStandalone) process.exit(1);
        throw error;
    }
}

// Only auto-start if this file is run directly (standalone mode)
if (require.main === module) {
    startWorker(true);
}

