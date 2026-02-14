import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../config/logger';
import { redisConnection } from '../../config/redis';
import { AccessContext, EventType, MemolinkEvent } from './event.types';

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
        try {
            const result = await (this.redis as any).xread('BLOCK', '30000', 'COUNT', count.toString(), 'STREAMS', this.STREAM_KEY, lastId);

            if (!result || result.length === 0) return [];

            const streamData = result[0]; // [key, entries]
            const entries: any[] = streamData[1]; // [[id, [field, value]], ...]

            return entries.map((entry: any[]) => {
                const id = entry[0];
                const fields = entry[1];
                const dataStr = fields[1]; // We stored as 'event', JSON
                const event = JSON.parse(dataStr);
                return { streamId: id, event };
            });
        } catch (error) {
            logger.error('[EventStream] Read failed', error);
            throw error;
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

    /**
     * Reads events from a consumer group.
     */
    async readGroup(groupName: string, consumerName: string, count: number = 10): Promise<{ streamId: string, event: MemolinkEvent }[]> {
        try {
            // '>' means only new messages that haven't been delivered to other consumers in the group
            const result = await (this.redis as any).xreadgroup('GROUP', groupName, consumerName, 'BLOCK', '30000', 'COUNT', count.toString(), 'STREAMS', this.STREAM_KEY, '>');

            if (!result || result.length === 0) return [];

            const streamData = result[0];
            const entries: any[] = streamData[1];

            return entries.map((entry: any[]) => {
                const id = entry[0];
                const fields = entry[1];
                const dataStr = fields[1];
                const event = JSON.parse(dataStr);
                return { streamId: id, event };
            });
        } catch (error) {
            logger.error(`[EventStream] readGroup failed for ${groupName}`, error);
            throw error;
        }
    }

    /**
     * Acknowledges a message in a consumer group.
     */
    async ack(groupName: string, streamId: string): Promise<void> {
        try {
            await this.redis.xack(this.STREAM_KEY, groupName, streamId);
        } catch (error) {
            logger.error(`[EventStream] ack failed for ${streamId}`, error);
        }
    }
}

export const eventStream = new EventStream();
