import { z } from 'zod';
import { logger } from '../../../config/logger';
import { redisConnection } from '../../../config/redis';
import { LLMService } from '../../../core/llm/llm.service';
import { entityService } from '../../entity/entity.service';
import { NodeType } from '../../graph/edge.model';
import { AGENT_CONSTANTS } from '../agent.constants';
import agentService from '../services/agent.service';
import { IAgentWorkflow } from '../agent.interfaces';
import { IAgentTaskDocument } from '../agent.model';
import { AgentTaskType, AgentWorkflowResult } from '../agent.types';
import { agentMemoryService } from '../memory/agent.memory';

const flushSchema = z.object({
    observations: z.array(z.object({
        target: z.string().describe("Entity name or 'USER' for the user's global profile."),
        content: z.string().describe("The derived fact, preference, or observation in natural language."),
        importance: z.number().min(1).max(5).describe("How critical this info is."),
        type: z.enum(['fact', 'preference', 'pattern', 'context']).describe("Nature of the information.")
    })).describe("Information extracted from the chat that should be remembered long-term."),
    associations: z.array(z.object({
        source: z.string().describe("Subject of the relationship."),
        target: z.string().describe("Object of the relationship."),
        relation: z.string().describe("Type of relationship (WORKS_AT, KNOWS, ASSOCIATED_WITH, etc.)."),
        metadata: z.record(z.string(), z.any()).optional()
    })).optional().describe("Relationships discovered during the conversation.")
});

export class MemoryFlushWorkflow implements IAgentWorkflow {
    public readonly type = AgentTaskType.MEMORY_FLUSH;

    async execute(task: IAgentTaskDocument): Promise<AgentWorkflowResult> {
        const { userId } = task;
        const { count = AGENT_CONSTANTS.FLUSH_COUNT } = (task.inputData as any) || {};

        // 1. Get History
        const history = await agentMemoryService.getHistory(userId);
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
        - For Associations: Capture how entities relate (e.g., "User works at Opstin", "Alice is Bob's wife").
        - If no new long-term info is found, return empty arrays.
        `;

        try {
            const result = await LLMService.generateJSON(prompt, flushSchema, {
                workflow: 'memory_flush',
                userId,
            });
            const { observations } = result;

            if (observations.length > 0) {
                for (const obs of observations) {
                    const formattedObs = `\n- [${obs.type.toUpperCase()} ${new Date().toLocaleDateString()}]: ${obs.content} (Importance: ${obs.importance})`;

                    if (obs.target.toUpperCase() === 'USER') {
                        // Update Persona
                        const persona = await agentService.getPersona(userId);
                        if (persona) {
                            const newMarkdown = (persona.rawMarkdown || '') + formattedObs;
                            await agentService.updatePersona(userId, {
                                rawMarkdown: newMarkdown
                            });

                            if (newMarkdown.length > AGENT_CONSTANTS.CONSOLIDATION_THRESHOLD) {
                                await agentService.triggerSynthesis(userId);
                                logger.info(`MemoryFlush: Triggered Synthesis for Persona (Size: ${newMarkdown.length})`);
                            }
                        }
                    } else {
                        // Update or Create Entity (TAO)
                        try {
                            const entity = await entityService.findOrCreateEntity(userId, obs.target, NodeType.ENTITY);

                            const newMarkdown = (entity.rawMarkdown || '') + formattedObs;

                            await entityService.updateEntity(entity._id.toString(), userId, {
                                rawMarkdown: newMarkdown,
                                interactionCount: (entity.interactionCount || 0) + 1
                            });

                            // Check for Narrative Consolidation need
                            if (newMarkdown.length > AGENT_CONSTANTS.CONSOLIDATION_THRESHOLD) {
                                await agentService.createTask(userId, AgentTaskType.ENTITY_CONSOLIDATION, {
                                    entityId: entity._id.toString(),
                                    userId
                                });
                                logger.info(`MemoryFlush: Triggered Consolidation for entity "${entity.name}" (Size: ${newMarkdown.length})`);
                            }

                            logger.info(`MemoryFlush: Attached observation to entity "${entity.name}" (${entity._id})`);
                        } catch (err) {
                            logger.error(`MemoryFlush: Failed to process entity observation for "${obs.target}"`, err);
                        }
                    }
                }
            }

            // 4. Handle Associations (Graph)
            const associations = result.associations || [];
            if (associations.length > 0) {
                const { graphService } = await import('../../graph/graph.service');

                for (const assoc of associations) {
                    try {
                        // Normalize Source and Target
                        const sourceEntity = assoc.source.toUpperCase() === 'USER'
                            ? { _id: userId, otype: NodeType.USER }
                            : await entityService.findOrCreateEntity(userId, assoc.source, NodeType.ENTITY);

                        const targetEntity = assoc.target.toUpperCase() === 'USER'
                            ? { _id: userId, otype: NodeType.USER }
                            : await entityService.findOrCreateEntity(userId, assoc.target, NodeType.ENTITY);

                        await graphService.createAssociation({
                            fromId: sourceEntity._id.toString(),
                            fromType: sourceEntity.otype as NodeType,
                            toId: targetEntity._id.toString(),
                            toType: targetEntity.otype as NodeType,
                            relation: assoc.relation as any,
                            metadata: { ...assoc.metadata, source: 'memory-flush' }
                        });
                        logger.info(`MemoryFlush: Created association ${assoc.relation} between ${assoc.source} and ${assoc.target}`);
                    } catch (err) {
                        logger.warn(`MemoryFlush: Failed to create association: ${err}`);
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
    }
}

export const memoryFlushWorkflow = new MemoryFlushWorkflow();
