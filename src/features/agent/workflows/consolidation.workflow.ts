import { z } from 'zod';
import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/llm.service';
import { entityService } from '../../entity/entity.service';
import { AgentWorkflow } from '../agent.types';

const consolidationSchema = z.object({
    summary: z.string().describe("A 1-2 sentence executive summary of who/what this entity is."),
    rawMarkdown: z.string().describe("A structured, clean Markdown document synthesized from the raw observations. Use headers and clear sections."),
    keyAttributes: z.array(z.string()).describe("Top 5 most defining facts or tags.")
});

const cognitiveSchema = z.object({
    updatedSummary: z.string().describe("An updated executive summary of the user's current state, priorities, and style."),
    styleNotes: z.string().describe("Observations about the user's conversational style, humor, energy levels, or linguistic patterns."),
    newFacts: z.array(z.string()).describe("A list of new concrete facts learned about the user in this session."),
    rawMarkdown: z.string().describe("The full updated Persona Markdown document.")
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

/**
 * Cognitive Consolidation:
 * Analyzes short-term chat memory to update the user's Long-term Persona.
 * Bridges the gap between chatting and structured knowledge.
 */
export const runCognitiveConsolidation: AgentWorkflow = async (task) => {
    const { userId, messageCount = 10 } = task.inputData;

    try {
        const { agentMemory } = await import('../agent.memory');
        const { personaService } = await import('../persona.service');

        // 1. Fetch Context
        const [history, currentPersona] = await Promise.all([
            agentMemory.getHistory(userId),
            personaService.getPersona(userId)
        ]);

        const recentMessages = history.slice(-messageCount);
        if (recentMessages.length < 3) {
            return { status: 'completed', result: { message: 'Not enough new history to consolidate' } };
        }

        const historyText = recentMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

        // 2. LLM Analysis
        const prompt = `
        You are a Cognitive Psychologist and Persona Engineer for MemoLink.
        Your goal is to analyze the recent chat history and update the user's "Persona Document".
        
        CURRENT PERSONA:
        ${currentPersona.rawMarkdown || 'No persona data yet.'}
        
        RECENT CHAT HISTORY:
        ${historyText}
        
        TASK:
        1. **Detect Style Shifts**: Has the user's tone changed? Are they stressed, excited, or more formal lately?
        2. **Extract New Facts**: Did they mention a new project, a preference, or a personal detail?
        3. **Synthesize**: Update the Persona document. Do not just append; integrate the new information into the existing Markdown structure.
        4. **Maintain Depth**: Keep the persona nuanced and multi-dimensional.
        `;

        const update = await LLMService.generateJSON(prompt, cognitiveSchema);

        // 3. Update Persona
        await personaService.updatePersona(userId, {
            summary: update.updatedSummary,
            rawMarkdown: update.rawMarkdown
        });

        logger.info(`CognitiveConsolidation: Updated persona for user ${userId} based on ${recentMessages.length} messages.`);

        return {
            status: 'completed',
            result: {
                messagesAnalyzed: recentMessages.length,
                factsFound: update.newFacts.length
            }
        };

    } catch (error: any) {
        logger.error(`CognitiveConsolidation: Workflow failed for user ${userId}`, error);
        return { status: 'failed', error: error.message };
    }
};
