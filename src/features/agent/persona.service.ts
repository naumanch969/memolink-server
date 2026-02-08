import { logger } from '../../config/logger';
import { agentService } from './agent.service';
import { AgentTaskType } from './agent.types';
import { IUserPersonaDocument, UserPersona } from './persona.model';

export class PersonaService {
    /**
     * Get or create a user's persona
     */
    async getPersona(userId: string): Promise<IUserPersonaDocument> {
        let persona = await UserPersona.findOne({ userId });

        if (!persona) {
            persona = await UserPersona.create({
                userId,
                summary: 'Synthesizing your second brain...',
                rawMarkdown: '# Persona Loading...\nShare more thoughts to help me build your profile.',
                lastSynthesized: new Date()
            });
        }

        return persona;
    }

    /**
     * Trigger a background synthesis of the persona
     */
    async triggerSynthesis(userId: string, force: boolean = false): Promise<void> {
        const persona = await this.getPersona(userId);

        // Throttling: 24h interval unless forced
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (!force && persona.lastSynthesized > oneDayAgo && persona.rawMarkdown.length > 100) {
            return;
        }

        await agentService.createTask(userId, AgentTaskType.PERSONA_SYNTHESIS, { force });
        logger.info(`Persona synthesis task enqueued for user ${userId}`);
    }

    /**
     * Format persona for LLM context (The OpenClaw Pattern)
     */
    async getPersonaContext(userId: string): Promise<string> {
        const persona = await this.getPersona(userId);

        if (!persona.rawMarkdown) {
            return "No persona data available yet.";
        }

        return `
USER PERSONA SOURCE OF TRUTH (MEMORY.md):
-------------------------------------------
${persona.rawMarkdown}
-------------------------------------------
Executive Summary: ${persona.summary}
        `.trim();
    }
}

export const personaService = new PersonaService();
