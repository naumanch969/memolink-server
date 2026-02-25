import { z } from 'zod';
import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/llm.service';
import Entry from '../../entry/entry.model';
import { IAgentTaskDocument } from '../agent.model';
import { AgentTaskType, AgentWorkflowResult, IAgentWorkflow } from '../agent.types';
import { UserPersona } from '../memory/persona.model';

const PersonaSynthesisSchema = z.object({
    summary: z.string().describe('A 2-3 sentence executive summary of the user\'s current state and focus.'),
    rawMarkdown: z.string().describe('The comprehensive "Living Persona" document in Markdown. Use headers, bullet points, and deep psychological analysis.')
});

export class PersonaWorkflow implements IAgentWorkflow {
    public readonly type = AgentTaskType.PERSONA_SYNTHESIS;

    async execute(task: IAgentTaskDocument): Promise<AgentWorkflowResult> {
        const { userId } = task;
        try {
            logger.info(`Starting deep persona synthesis for user ${userId}`);

            // 1. Fetch Context
            const [persona, entries] = await Promise.all([
                UserPersona.findOne({ userId }),
                Entry.find({ userId }).sort({ date: -1 }).limit(100).select('content date').lean()
            ]);

            if (!entries || entries.length === 0) {
                logger.info(`No entries found for user ${userId}, synthesis skipping.`);
                return { status: 'completed', result: { note: 'No data to synthesize' } };
            }

            const entriesText = entries
                .map((e: any) => `[${new Date(e.date).toLocaleDateString()}] ${e.content}`)
                .join('\n---\n');

            const existingRawMarkdown = persona?.rawMarkdown || 'No existing persona document.';

            // 2. Synthesize with LLM
            const prompt = `
            You are a Master Psychologist and Chief of Staff. Your task is to maintain a "Living Persona" document (MEMORY.md) for the user.
            This document is the absolute source of truth for who the user is, how they think, and what they value.

            EXISTING DOCUMENT:
            ${existingRawMarkdown}

            RECENT SIGNAL DATA (Last 100 entries):
            ${entriesText}

            INSTRUCTIONS:
            1. **Evolution**: Do not just overwrite. Evolve the document. If a pattern is confirmed, reinforce it. If a new nuance emerges, document it.
            2. **Structure**: The 'rawMarkdown' field must be a beautifully formatted Markdown document. 
               Suggested sections:
               # USER PERSONA: [Brief Title]
               ## 🧠 Psychological Architecture (Core drivers, fears, cognitive styles)
               ## ⚖️ Value System (What defaults do they optimize for?)
               ## 🏗️ Operational Patterns (Habits, work style, productivity flaws)
               ## 🗣️ Communication Protocols (How they like to be addressed, preferred level of detail)
               ## 🎯 Current Vector (What is their primary focus/tension right now?)
            3. **Executive Summary**: Provide a 2-3 sentence 'summary' for quick dashboard display.
            4. **Precision**: Avoid fluff. Be direct. If the user is struggling with procrastination, call it out. If they are ambitious but disorganized, document that contradiction.

            Format the output as JSON matching the schema provided.
        `;

            const synthesis = await LLMService.generateJSON(prompt, PersonaSynthesisSchema, {
                workflow: 'persona_synthesis',
                userId,
            });

            // 3. Update Database
            if (persona) {
                persona.summary = synthesis.summary;
                persona.rawMarkdown = synthesis.rawMarkdown;
                persona.lastSynthesized = new Date();
                await persona.save();
            } else {
                await UserPersona.create({
                    userId,
                    summary: synthesis.summary,
                    rawMarkdown: synthesis.rawMarkdown,
                    lastSynthesized: new Date()
                });
            }

            logger.info(`Persona document updated for user ${userId}`);
            return { status: 'completed', result: synthesis };

        } catch (error: any) {
            logger.error(`Persona synthesis failed for user ${userId}`, error);
            return { status: 'failed', error: error.message };
        }
    }
}

export const personaWorkflow = new PersonaWorkflow();
