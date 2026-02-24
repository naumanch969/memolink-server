import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/llm.service';
import { entityService } from '../../entity/entity.service';
import { graphService } from '../../graph/graph.service';
import { AGENT_CONSTANTS } from '../agent.constants';
import { agentMemoryService } from '../memory/agent.memory';
import agentService from '../services/agent.service';

import { IChatOrchestrator } from '../agent.interfaces';

export class ChatOrchestrator implements IChatOrchestrator {

    async chat(userId: string, message: string, options: { onFinish?: (answer: string) => Promise<void> } = {}): Promise<string> {
        // 1. Persist user message (Assumed already persisted by AgentService before calling orchestrator if following capture-first)
        // actually AgentService.chat does it at the start.

        // 2. TAO: Fast Entity Detection (Redis Registry)
        const entityRegistry = await entityService.getEntityRegistry(userId);
        const detectedEntityIds = new Set<string>();

        const names = Object.keys(entityRegistry);
        if (names.length > 0) {
            const escapedNames = names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            const combinedRegex = new RegExp(`\\b(${escapedNames.join('|')})(?:'s)?\\b`, 'gi');

            let match;
            while ((match = combinedRegex.exec(message)) !== null) {
                const matchedNameWithPossessive = match[0].toLowerCase();
                const matchedName = matchedNameWithPossessive.replace(/'s$/, '');
                const id = entityRegistry[matchedName];
                if (id) detectedEntityIds.add(id);
            }
        }

        // 3. TAO: 1-Hop Knowledge Retrieval
        const detectedEntityContexts: string[] = [];
        if (detectedEntityIds.size > 0) {
            const entityIds = Array.from(detectedEntityIds);
            const entities = await entityService.getEntitiesByIds(entityIds, userId);

            const contexts = await graphService.getEntitiesContext(
                entities.map(e => ({ id: e._id.toString(), name: e.name }))
            );

            entities.forEach((entity) => {
                let contextBlock = `ENTITY: ${entity.name} (${entity.otype})\n`;
                if (entity.summary) contextBlock += `Summary: ${entity.summary}\n`;

                const gContext = contexts.find(c => c.includes(`ENTITY: ${entity.name}`));
                if (gContext) contextBlock += `${gContext}\n`;

                if (entity.rawMarkdown) {
                    contextBlock += `Notes:\n${entity.rawMarkdown.slice(0, AGENT_CONSTANTS.ENTITY_NOTES_SLICE)}\n`;
                }
                detectedEntityContexts.push(contextBlock);
            });
        }

        // 4. Get Full Context
        const [history, graphSummary, personaContext] = await Promise.all([
            agentMemoryService.getHistory(userId),
            graphService.getGraphSummary(userId),
            agentService.getPersonaContext(userId)
        ]);

        const previousHistory = history
            .filter(h => h.content !== message || h.timestamp < Date.now() - 1000)
            .slice(-AGENT_CONSTANTS.MAX_CONTEXT_MESSAGES);

        const promptHistory = previousHistory.map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n');

        const systemPrompt = `You are Memolink, a supportive and intelligent life partner (AI). 
        Your goal is to be a natural, conversational presence. You are not just a tool; you are a partner in the user's journey.

        Today is ${new Date().toDateString()}.

        DETECTED ENTITIES (Long-term Memory):
        ${detectedEntityContexts.join('\n---\n') || "None mentioned in this message."}

        USER'S GLOBAL CONTEXT:
        ${graphSummary}

        USER'S PERSONA:
        ${personaContext}
        
        Recent Conversation History:
        ${promptHistory}
        
        Current User Message: ${message}

        CONVERSATIONAL GUIDELINES:
        - Be natural, empathetic, and concise. 
        - DO NOT list your capabilities unless asked.
        - Use the DETECTED ENTITIES context to show you remember their world.
        - Match the user's energy level.

        RESPONSE FORMATTING:
        - Use standard Markdown.
        - Bold key information like dates or titles.
        `;

        const currentPrompt = systemPrompt;
        let iteration = 0;
        const MAX_ITERATIONS = AGENT_CONSTANTS.MAX_RE_ACT_ITERATIONS;

        try {
            while (iteration < MAX_ITERATIONS) {
                iteration++;

                const response = await LLMService.generateText(currentPrompt, {
                    workflow: 'chat_orchestrator',
                    userId,
                });

                if (response) {
                    const finalAnswer = response;
                    if (options.onFinish) await options.onFinish(finalAnswer);
                    return finalAnswer;
                } else {
                    return "I'm unsure how to proceed. Could you rephrase that?";
                }
            }
            return "I've been working on this for a while but couldn't finish. Please check the recent items.";

        } catch (error) {
            logger.error('Agent chat loop failed', error);
            return "I'm sorry, I encountered an error while processing your request.";
        }
    }
}

export const chatOrchestratorService = new ChatOrchestrator();
export const chatOrchestrator = chatOrchestratorService;
