
import { logger } from '../../config/logger';
import { redisConnection } from '../../config/redis';

export interface ChatMessage {
    role: 'user' | 'agent' | 'system';
    content: string;
    timestamp: number;
}

const MEMORY_TTL = 60 * 60 * 24; // 24 hours
const MAX_HISTORY = 10;

export class AgentMemory {

    private getKey(userId: string): string {
        return `agent:memory:${userId}`;
    }

    /**
     * Add a message to the user's short-term memory
     */
    async addMessage(userId: string, role: 'user' | 'agent' | 'system', content: string) {
        const key = this.getKey(userId);
        const message: ChatMessage = { role, content, timestamp: Date.now() };

        try {
            // Push to list
            await redisConnection.rpush(key, JSON.stringify(message));

            // Trim to prevent infinite growth (keep last N)
            await redisConnection.ltrim(key, -MAX_HISTORY, -1);

            // Refresh TTL
            await redisConnection.expire(key, MEMORY_TTL);
        } catch (error) {
            logger.error(`Failed to add message to memory for user ${userId}`, error);
        }
    }

    /**
     * Get recent conversation history
     */
    async getHistory(userId: string): Promise<ChatMessage[]> {
        const key = this.getKey(userId);
        try {
            const raw = await redisConnection.lrange(key, 0, -1);
            return raw.map(item => JSON.parse(item) as ChatMessage);
        } catch (error) {
            logger.error(`Failed to get history for user ${userId}`, error);
            return [];
        }
    }

    /**
     * Clear memory (e.g. start new session)
     */
    async clear(userId: string) {
        await redisConnection.del(this.getKey(userId));
    }
}

export const agentMemory = new AgentMemory();
