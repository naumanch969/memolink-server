import IORedis from 'ioredis';
import { config } from './env';
import { logger } from './logger';

export const redisConnection = new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
});

redisConnection.on('connect', () => {
    logger.info('Redis connection established');
});

redisConnection.on('error', (err) => {
    logger.error('Redis connection error:', err);
});

export default redisConnection;
