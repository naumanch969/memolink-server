import { logger } from '../../config/logger';
import { redisConnection } from '../../config/redis';

export interface ICacheService {
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: any, ttl?: number): Promise<void>;
    del(key: string): Promise<void>;
    getEmbeddingKey(text: string): string;
    getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T>;
}

export class CacheService implements ICacheService {
    private readonly TTL = 24 * 60 * 60; // 24 hours in seconds

    // get cached value by key
    async get<T>(key: string): Promise<T | null> {
        try {
            const data = await redisConnection.get(key);
            if (!data) return null;
            return JSON.parse(data);
        } catch (error) {
            logger.error('Cache get error:', error);
            return null;
        }
    }

    // set caches value with key
    async set(key: string, value: any, ttl: number = this.TTL): Promise<void> {
        try {
            const data = JSON.stringify(value);
            await redisConnection.set(key, data, 'EX', ttl);
        } catch (error) {
            logger.error('Cache set error:', error);
        }
    }

    // delete cached value by key
    async del(key: string): Promise<void> {
        try {
            await redisConnection.del(key);
        } catch (error) {
            logger.error('Cache del error:', error);
        }
    }

    // get or set cache value
    async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl: number = this.TTL): Promise<T> {
        try {
            const cached = await this.get<T>(key);
            if (cached !== null) {
                return cached;
            }
        } catch (error) {
            logger.error('Cache getOrSet read error:', error);
        }

        const value = await fetcher();

        try {
            await this.set(key, value, ttl);
        } catch (error) {
            logger.error('Cache getOrSet write error:', error);
        }

        return value;
    }

    // generate a cache key for an embedding query
    getEmbeddingKey(text: string): string {
        // Basic sanitization and hashing would be better, but for now simple key
        const sanitized = text.trim().toLowerCase();
        return `embedding:${Buffer.from(sanitized).toString('base64').slice(0, 100)}`;
    }
}

export const cacheService = new CacheService();
export default cacheService;

