import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/llm.service';
import { entityService } from '../../entity/entity.service';
import { graphService } from '../../graph/graph.service';
import { toolRegistry } from '../../integrations/tools/tool.registry';
import { AGENT_CONSTANTS } from '../agent.constants';
import { agentMemoryService } from '../memory/agent.memory';
import agentService from '../services/agent.service';

import { IChatOrchestrator } from '../agent.interfaces';

export class ChatOrchestrator implements IChatOrchestrator {

    async chat(userId: string, message: string, options: { onFinish?: (answer: string) => Promise<void> } = {}): Promise<string> {
        // 1. TAO: Fast Entity Detection
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

        // 2. TAO: 1-Hop Knowledge Retrieval
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

        // 3. Get Full Context
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

        Today is ${new Date().toISOString()}.

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
        - If you use a tool to get information, briefly mention it naturally in your response (e.g. "I checked your calendar and...").
        - If a tool fails because an account isn't connected, kindly prompt the user to connect it.

        RESPONSE FORMATTING:
        - Use standard Markdown.
        - Bold key information like dates or titles.
        `;

        // The running conversation for this specific interaction, including tool calls and results
        // We start with the system prompt, which contains the user's message
        let currentPrompt = systemPrompt;
        let iteration = 0;
        const MAX_ITERATIONS = 5; // Allow up to 5 tool calls per chat message

        try {
            while (iteration < MAX_ITERATIONS) {
                iteration++;

                // Call Gemini, explicitly passing the tools available to it
                const response = await LLMService.generateWithTools(currentPrompt, {
                    workflow: 'chat_orchestrator',
                    userId,
                    tools: toolRegistry.getAllDefinitions()
                });

                // Scenario A: Gemini responded with just text (either its first response, or synthesizing tool results)
                if (response.text && !response.functionCalls) {
                    const finalAnswer = response.text;
                    if (options.onFinish) await options.onFinish(finalAnswer);
                    return finalAnswer;
                }

                // Scenario B: Gemini responded with text AND a function call
                // Scenario C: Gemini responded with ONLY a function call
                if (response.functionCalls && response.functionCalls.length > 0) {
                    // We only process the first function call for simplicity in this loop
                    const call = response.functionCalls[0];
                    logger.info(`Agent triggered tool: ${call.name} for user ${userId}`, { args: call.args });

                    // Execute the tool and get the result
                    const toolResult = await toolRegistry.executeToolCall(call.name, call.args, userId);

                    logger.info(`Tool ${call.name} returned result for user ${userId}`);

                    // Append the tool call and result to the prompt so Gemini knows what happened
                    // and can formulate its final response based on this data.
                    currentPrompt += `\n\n--- TOOL EXECUTION ---\n`;
                    currentPrompt += `Agent Called: ${call.name}\n`;
                    currentPrompt += `Arguments: ${JSON.stringify(call.args)}\n`;
                    currentPrompt += `Result: ${JSON.stringify(toolResult)}\n`;
                    currentPrompt += `\nBased on this result, provide your final response to the user.`;

                    // Loop continues, sending this updated prompt back to Gemini
                } else if (!response.text) {
                    // Guard against empty responses
                    return "I'm unsure how to proceed. Could you rephrase that?";
                }
            }

            return "I've been working on this for a while but couldn't finish. I might need more specific instructions.";

        } catch (error) {
            logger.error('Agent chat loop failed', error);
            return "I'm sorry, I encountered an error while processing your request.";
        }
    }
}

export const chatOrchestratorService = new ChatOrchestrator();
export const chatOrchestrator = chatOrchestratorService;
