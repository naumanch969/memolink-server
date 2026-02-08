import { z } from 'zod';
import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/LLMService';
import { entityService } from '../../entity/entity.service';
import { AgentWorkflow } from '../agent.types';

const consolidationSchema = z.object({
    summary: z.string().describe("A 1-2 sentence executive summary of who/what this entity is."),
    rawMarkdown: z.string().describe("A structured, clean Markdown document synthesized from the raw observations. Use headers and clear sections."),
    keyAttributes: z.array(z.string()).describe("Top 5 most defining facts or tags.")
});

/**
 * Recursive Narrative Consolidation:
 * Synthesizes long logs of raw observations into a structured "Source of Truth".
 */
export const runEntityConsolidation: AgentWorkflow = async (task) => {
    const { entityId, userId } = task.inputData;

    try {
        // 1. Fetch Entity
        const entity = await entityService.getEntityById(entityId, userId);
        if (!entity.rawMarkdown || entity.rawMarkdown.length < 50) {
            return { status: 'completed', result: { message: 'Not enough data to consolidate' } };
        }

        // 2. Call LLM for Synthesis
        const prompt = `
        You are a Master Archivist for an intelligent personal assistant.
        Your task is to consolidate a "Raw Observation Log" into a "Structured Narrative".

        ENTITY: ${entity.name} (${entity.otype})
        CURRENT SUMMARY: ${entity.summary || 'None'}

        RAW OBSERVATIONS:
        ${entity.rawMarkdown}

        INSTRUCTIONS:
        1. **Eliminate Redundancy**: If the same fact is mentioned multiple times, keep the most recent/detailed version.
        2. **Identify Patterns**: Move from "User said X once" to "User consistently prefers X".
        3. **Structure**: Use a logical Markdown structure (e.g., # Background, # Preferences, # Project History).
        4. **Tone**: Objective, professional, yet helpful for a Chief of Staff AI.
        5. **Distinction**: Keep critical historical facts but summarize fleeting contexts.
        `;

        const synthesis = await LLMService.generateJSON(prompt, consolidationSchema);

        // 3. Update Entity
        await entityService.updateEntity(entityId, userId, {
            summary: synthesis.summary,
            rawMarkdown: synthesis.rawMarkdown,
            tags: Array.from(new Set([...(entity.tags || []), ...synthesis.keyAttributes]))
        });

        logger.info(`EntityConsolidation: Successfully crunched narrative for "${entity.name}" (${entityId})`);

        return {
            status: 'completed',
            result: {
                previousSize: entity.rawMarkdown.length,
                newSize: synthesis.rawMarkdown.length,
                entityName: entity.name
            }
        };

    } catch (error: any) {
        logger.error(`EntityConsolidation: Workflow failed for entity ${entityId}`, error);
        return { status: 'failed', error: error.message };
    }
};
