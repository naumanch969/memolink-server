
import { Types } from 'mongoose';
import { logger } from '../../../config/logger';
import { redisConnection } from '../../../config/redis';
import { AGENT_CONSTANTS } from '../agent.constants';
import { IAgentMemoryService } from '../agent.interfaces';
import { IChatMessage } from "../agent.types";
import { ChatMemory } from './agent.memory.model';

export class AgentMemory implements IAgentMemoryService {

    private getKey(userId: string | Types.ObjectId): string {
        return `agent:memory:${userId}`;
    }

    // Add a message to the user's short-term memory
    async addMessage(userId: string | Types.ObjectId, role: 'user' | 'agent' | 'system', content: string): Promise<void> {
        const key = this.getKey(userId);
        const message: IChatMessage = { role, content, timestamp: Date.now() };

        // 1. Always save to Mongo as a reliable backup
        try {
            await ChatMemory.findOneAndUpdate(
                { userId },
                {
                    $push: { messages: message },
                    $set: { updatedAt: new Date() }
                },
                { upsert: true }
            );
        } catch (mongoError) {
            logger.error(`Reliability Fallback Failed: Could not save memory to Mongo for ${userId}`, mongoError);
        }

        // 2. Try Redis for performance
        try {
            await redisConnection.rpush(key, JSON.stringify(message));
            await redisConnection.ltrim(key, -AGENT_CONSTANTS.MAX_HISTORY, -1);
            await redisConnection.expire(key, AGENT_CONSTANTS.MEMORY_TTL);
        } catch (error: any) {
            // Check if it's a Redis specific error like limit exceeded
            if (error.message?.includes('max requests limit exceeded')) {
                logger.warn(`Redis Limit Hit: Falling back to MongoDB for user ${userId} context`);
                return;
            }
            logger.error(`Failed to add message to Redis memory for user ${userId}`, error);
        }
    }

    // Get recent conversation history
    async getHistory(userId: string | Types.ObjectId): Promise<IChatMessage[]> {
        const key = this.getKey(userId);

        // 1. Try Redis first
        try {
            const raw = await redisConnection.lrange(key, 0, -1);
            if (raw && raw.length > 0) {
                return raw.map(item => JSON.parse(item) as IChatMessage);
            }
        } catch (error: any) {
            logger.warn(`Redis lookup failed for ${userId}, checking MongoDB fallback...`);
        }

        // 2. Fallback to MongoDB
        try {
            const fallback = await ChatMemory.findOne({ userId });
            if (fallback) {
                return fallback.messages;
            }
        } catch (mongoError) {
            logger.error(`Complete Memory Failure: Both Redis and Mongo failed for ${userId}`, mongoError);
        }

        return [];
    }

    // Clear memory (e.g. start new session)
    async clear(userId: string | Types.ObjectId): Promise<void> {
        try {
            await Promise.all([
                redisConnection.del(this.getKey(userId)),
                ChatMemory.deleteOne({ userId })
            ]);
        } catch (error) {
            logger.error(`Failed to clear memory for user ${userId}`, error);
        }
    }

    async flush(userId: string | Types.ObjectId, count: number): Promise<void> {
        // Implementation for flush
    }

    async saveToArchive(userId: string | Types.ObjectId, messages: IChatMessage[]): Promise<void> {
        // Implementation for saveToArchive
    }
}

export const agentMemoryService = new AgentMemory();
