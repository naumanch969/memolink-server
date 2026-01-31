import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../config/logger';
import { redisConnection } from '../../config/redis';
import { AccessContext, EventType, MemolinkEvent } from './types';

export class EventStream {
    private redis: Redis;
    private readonly STREAM_KEY = 'memolink:events:v1';

    constructor() {
        this.redis = redisConnection;
    }

    /**
     * Publishes a factual event to the Immutable Stream.
     * @param type The strictly typed event kind
     * @param userId The user ID
     * @param payload The strict payload
     * @param source Metadata about where this came from
     */
    async publish<T>(
        type: EventType,
        userId: string,
        payload: T,
        source: AccessContext = { deviceId: 'server', platform: 'server', version: '1.0.0' },
        meta: any = {}
    ): Promise<string> {
        const event: MemolinkEvent<T> = {
            id: uuidv4(),
            type,
            timestamp: Date.now(),
            userId,
            source,
            payload,
            meta
        };

        try {
            // Serialize payload context for Redis
            // Redis Streams are Key-Value pairs. We store the whole JSON in 'data'.
            const entryId = await this.redis.xadd(
                this.STREAM_KEY,
                '*', // auto-generate ID
                'event', JSON.stringify(event)
            );

            logger.debug(`[EventStream] Published ${type} for ${userId} (ID: ${entryId})`);
            return entryId as string;
        } catch (error) {
            logger.error(`[EventStream] Failed to publish event ${type}`, error);
            throw error;
        }
    }

    /**
     * Reads events from the stream (for Workers).
     * @param lastId The ID of the last processed event
     * @param count Batch size
     */
    async read(lastId: string = '$', count: number = 100): Promise<{ streamId: string, event: MemolinkEvent }[]> {
        // XREAD BLOCK 0 STREAMS key lastId
        // Note: For a real worker, we'd use Consumer Groups (XREADGROUP).
        // For V0 simplicity, we expose raw read.

        try {
            const result = await this.redis.xread('COUNT', count, 'STREAMS', this.STREAM_KEY, lastId);

            if (!result) return [];

            const [[, entries]] = result; // Destructure output: [ [ 'key', [ [id, [field, value]] ] ] ]

            return entries.map(([id, fields]) => {
                const dataStr = fields[1]; // We stored as 'event', JSON
                const event = JSON.parse(dataStr);
                return { streamId: id, event };
            });
        } catch (error) {
            logger.error('[EventStream] Read failed', error);
            return [];
        }
    }

    /**
     * Creates a Consumer Group for robust processing
     */
    async createGroup(groupName: string): Promise<void> {
        try {
            await this.redis.xgroup('CREATE', this.STREAM_KEY, groupName, '0', 'MKSTREAM');
            logger.info(`[EventStream] Consumer Group '${groupName}' created.`);
        } catch (error: any) {
            if (!error.message.includes('BUSYGROUP')) {
                throw error;
            }
            // Group already exists, ignore
        }
    }
}

export const eventStream = new EventStream();
