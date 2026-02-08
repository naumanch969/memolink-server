import { z } from 'zod';
import { logger } from '../../../config/logger';
import { redisConnection } from '../../../config/redis';
import { LLMService } from '../../../core/llm/LLMService';
import { entityService } from '../../entity/entity.service';
import { agentMemory } from '../agent.memory';
import { AgentWorkflow } from '../agent.types';
import { personaService } from '../persona.service';

const flushSchema = z.object({
    observations: z.array(z.object({
        target: z.string().describe("Entity name or 'USER' for the user's global profile."),
        content: z.string().describe("The derived fact, preference, or observation in natural language."),
        importance: z.number().min(1).max(5).describe("How critical this info is.")
    })).describe("Information extracted from the chat that should be remembered long-term.")
});

export const runMemoryFlush: AgentWorkflow = async (task) => {
    const { userId } = task;
    const { count = 15 } = task.inputData || {};

    // 1. Get History
    const history = await agentMemory.getHistory(userId);
    if (history.length < count) {
        return { status: 'completed', result: { message: 'Not enough history to flush' } };
    }

    // 2. Select oldest chunk
    const chunkToFlush = history.slice(0, count);
    const historyText = chunkToFlush.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

    // 3. LLM Analysis
    const prompt = `
    Analyze the following conversation history and extract critical long-term information.
    Your goal is to "distill" temporary chat turns into permanent knowledge.

    Focus on:
    - User Preferences (e.g., "User likes early morning meetings", "User is anxious about X").
    - Entity Facts (e.g., "Alice is the User's CEO", "The project 'Aegis' is behind schedule").
    - Relationship Dynamics (e.g., "User and Bob have a strained relationship").
    - New Entities: If an entity mentioned isn't in the context, note its existence.

    Conversation:
    ${historyText}

    Instructions:
    - Only extract things that are worth remembering for weeks or months.
    - Be concise.
    - If no new long-term info is found, return an empty observations array.
    `;

    try {
        const result = await LLMService.generateJSON(prompt, flushSchema);
        const { observations } = result;

        if (observations.length > 0) {
            for (const obs of observations) {
                const formattedObs = `\n- [Observation ${new Date().toLocaleDateString()}]: ${obs.content} (Importance: ${obs.importance})`;

                if (obs.target.toUpperCase() === 'USER') {
                    // Update Persona
                    const persona = await personaService.getPersona(userId);
                    if (persona) {
                        await personaService.updatePersona(userId, {
                            rawMarkdown: (persona.rawMarkdown || '') + formattedObs
                        });
                    }
                } else {
                    // Update Entity
                    const registry = await entityService.getEntityRegistry(userId);
                    const entityId = registry[obs.target.toLowerCase()];
                    if (entityId) {
                        const entity = await entityService.getEntityById(entityId, userId);
                        await entityService.updateEntity(entityId, userId, {
                            rawMarkdown: (entity.rawMarkdown || '') + formattedObs
                        });
                    } else {
                        // Create entity if it's important? 
                        // For now, only update if it exists to prevent shadow entity explosion.
                        logger.debug(`MemoryFlush: Could not find entity "${obs.target}" to attach observation.`);
                    }
                }
            }
        }

        // 4. Remove flushed messages from Redis
        const key = `agent:memory:${userId}`;
        // LTRIM start index should be the count we flushed
        await redisConnection.ltrim(key, count, -1);

        logger.info(`Memory Flush completed for user ${userId}. Flushed ${count} messages.`);
        return {
            status: 'completed',
            result: {
                flushedCount: count,
                observationsFound: observations.length
            }
        };

    } catch (error: any) {
        logger.error('Memory Flush failed', error);
        return { status: 'failed', error: error.message };
    }
};
