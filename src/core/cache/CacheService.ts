import { logger } from '../../config/logger';
import { redisConnection } from '../../config/redis';

export class CacheService {
    private static TTL = 24 * 60 * 60; // 24 hours in seconds

    static async get<T>(key: string): Promise<T | null> {
        try {
            const data = await redisConnection.get(key);
            if (!data) return null;
            return JSON.parse(data);
        } catch (error) {
            logger.error('Cache get error:', error);
            return null;
        }
    }

    static async set(key: string, value: any, ttl: number = this.TTL): Promise<void> {
        try {
            const data = JSON.stringify(value);
            await redisConnection.set(key, data, 'EX', ttl);
        } catch (error) {
            logger.error('Cache set error:', error);
        }
    }

    static async del(key: string): Promise<void> {
        try {
            await redisConnection.del(key);
        } catch (error) {
            logger.error('Cache del error:', error);
        }
    }

    /**
     * Generates a cache key for an embedding query
     * @param text The search query text
     */
    static getEmbeddingKey(text: string): string {
        // Basic sanitization and hashing would be better, but for now simple key
        const sanitized = text.trim().toLowerCase();
        return `embedding:${Buffer.from(sanitized).toString('base64').slice(0, 100)}`;
    }
}
