import * as Sentry from '@sentry/node';
import IORedis from 'ioredis';
import { MetricsService } from '../features/monitoring/metrics.service';
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

// Optimization: Atomic Rate Limiter to save commands on Upstash
redisConnection.defineCommand('rateLimit', {
    numberOfKeys: 1,
    lua: `
        local current = redis.call('INCR', KEYS[1])
        if current == 1 then
            redis.call('PEXPIRE', KEYS[1], ARGV[1])
        end
        return current
    `,
});

// Optimization: Atomic History Management to save commands on Upstash (rpush + ltrim + expire)
redisConnection.defineCommand('pushToHistory', {
    numberOfKeys: 1,
    lua: `
        redis.call('RPUSH', KEYS[1], ARGV[1])
        redis.call('LTRIM', KEYS[1], ARGV[2], -1)
        redis.call('EXPIRE', KEYS[1], ARGV[3])
        return 1
    `,
});

redisConnection.on('connect', () => {
    logger.info('Redis connection established');
});

redisConnection.on('error', (err) => {
    logger.error('Redis connection error:', err);
    // Track errors as a metric
    MetricsService.increment('redis:errors');

    if (err.message?.includes('max requests limit exceeded')) {
        MetricsService.increment('redis:limit_hits');
        Sentry.captureMessage('Redis Rate Limit Exceeded (Upstash)', {
            level: 'fatal',
            extra: { originalError: err.message }
        });
    } else {
        Sentry.captureException(err);
    }
});

export default redisConnection;
