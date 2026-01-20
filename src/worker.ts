import mongoose from 'mongoose';
import { config } from './config/env';
import { logger } from './config/logger';
import redisConnection from './config/redis';
import { QueueService } from './core/queue/QueueService';
import { initAgentWorker } from './features/agent/agent.worker';
import { initEmailWorker } from './features/email/queue/email.worker';

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

        // 3. Register Workers Here
        initAgentWorker();
        initEmailWorker();

        logger.info('Worker service initialized. Waiting for jobs...');

        // Graceful Shutdown
        const shutdown = async (signal: string) => {
            logger.info(`${signal} received. Shutting down worker...`);
            try {
                await QueueService.close();
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
