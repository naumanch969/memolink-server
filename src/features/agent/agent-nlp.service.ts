import { logger } from '../../config/logger';
import { entryService } from '../entry/entry.service';
import { agentTaskService } from './agent-task.service';
import { agentIntent, AgentIntentType, IntentResult } from './agent.intent';
import { agentMemory } from './agent.memory';
import { intentDispatcher } from './handlers/intent.dispatcher';
import { personaService } from './persona.service';

export class AgentNLPService {
    /**
     * Processes natural language input using a "Capture First" reliability pattern.
     * 1. Persists raw input as an entry immediately.
     * 2. Classifies intents and updates memory.
     * 3. Dispatches actions and updates the entry status.
     */
    async process(userId: string, text: string, options: { tags?: string[], timezone?: string, source?: string } = {}): Promise<any> {
        // 1. Reliability Pattern: Capture to Library first
        let entry: any = null;
        try {
            entry = await entryService.createEntry(userId, {
                content: text,
                date: new Date(),
                type: 'text',
                status: 'captured',
                tags: options.tags || [],
                metadata: { source: options.source || 'capture-mode' }
            });
            logger.info("Reliability Capture: Entry saved before AI processing", { userId, entryId: entry._id });
        } catch (error) {
            logger.error("Reliability Capture Failed", error);
        }

        try {
            const history = await agentMemory.getHistory(userId);

            // 2. AI Intent Analysis
            let intentResult: IntentResult;
            try {
                intentResult = await agentIntent.classify(userId, text, history, options.timezone);
            } catch (aiError) {
                logger.warn("Intent analysis failed, falling back to journaling", aiError);
                intentResult = {
                    intents: [{ intent: AgentIntentType.JOURNALING, parsedEntities: { date: new Date() } }],
                    summary: "Saved as daily entry"
                };
            }

            // Handle Clarification loops
            const clarification = intentResult.intents.find(i => i.needsClarification);
            if (clarification) {
                if (entry?._id) await entryService.updateEntry(entry._id.toString(), userId, { status: 'ready' });
                return { ...clarification, originalText: text, result: entry };
            }

            await agentMemory.addMessage(userId, 'user', text);

            // 3. Dispatch Actions
            const dispatchResult = await intentDispatcher.dispatch({
                userId,
                text,
                entry,
                intentResult
            });

            if (dispatchResult.earlyReturn) {
                if (entry?._id) await entryService.updateEntry(entry._id.toString(), userId, { status: 'ready' });
                return dispatchResult.earlyReturn;
            }

            // 4. Record Tasks for Actions
            const tasks = [];
            for (const action of dispatchResult.actions) {
                const task = await agentTaskService.createTask(userId, action.taskType, {
                    text,
                    intent: action.taskType,
                    resultId: action.commandObject?._id?.toString()
                });
                tasks.push(task);
            }

            // Cleanup: Mark entry ready if no specific tasks were triggered
            if (dispatchResult.actions.length === 0 && entry?._id) {
                await entryService.updateEntry(entry._id.toString(), userId, { status: 'ready' });
            }

            const summary = dispatchResult.summary || `Processed ${intentResult.intents.length} intentions.`;
            await agentMemory.addMessage(userId, 'agent', summary);

            // Background Persona Sync
            personaService.triggerSynthesis(userId).catch(err => logger.error("Persona Synthesis trigger failed", err));

            return {
                tasks,
                result: dispatchResult.actions.length > 0 ? dispatchResult.actions[0].commandObject : entry,
                summary
            };

        } catch (error) {
            logger.error("Agent NLP Processing failed", error);
            if (entry?._id) {
                await entryService.updateEntry(entry._id.toString(), userId, { status: 'ready' });
            }
            throw error;
        }
    }

    /**
     * Finds semantically similar entries for a given text
     */
    async findSimilarEntries(userId: string, text: string, limit: number = 5): Promise<any[]> {
        try {
            const { Entry } = await import('../entry/entry.model');
            const { LLMService } = await import('../../core/llm/llm.service');
            const { entryService } = await import('../entry/entry.service');
            const { Types } = await import('mongoose');

            const queryVector = await LLMService.generateEmbeddings(text, { workflow: 'similarity_search', userId });

            try {
                const results = await Entry.aggregate([
                    {
                        $vectorSearch: {
                            index: "vector_index",
                            path: "embeddings",
                            queryVector: queryVector,
                            numCandidates: 100,
                            limit: limit,
                            filter: { userId: new Types.ObjectId(userId) }
                        }
                    },
                    {
                        $project: {
                            content: 1,
                            date: 1,
                            type: 1,
                            score: { $meta: "vectorSearchScore" }
                        }
                    }
                ]);

                if (results.length > 0) return results;
            } catch (vError) {
                logger.warn('Vector search failed or index missing. Falling back to keyword search.');
            }

            const { entries } = await entryService.searchEntries(userId, { q: text, limit });
            return entries.map(e => ({
                content: e.content,
                date: e.date,
                type: e.type,
                score: 0.5
            }));

        } catch (error) {
            logger.error('Similar entries lookup failed', error);
            return [];
        }
    }
    /**
     * Cleans raw text into a grammatically correct and polished format
     * while preserving original meaning and tone.
     */
    async cleanText(userId: string, text: string): Promise<string> {
        try {
            const { LLMService } = await import('../../core/llm/llm.service');

            const prompt = `
            You are a helpful behavioral journaling assistant. Your task is to clean up raw, fragmented, or messy text entries while preserving the original meaning, tone, and key facts. 
            
            Guidelines:
            - Fix grammar, spelling, and sentence structure.
            - Ensure the text flows naturally.
            - Preserve any tags (starting with #) and mentions (starting with @).
            - Keep the tone personal and reflective as it's a journal.
            - Do not add any new information that wasn't implied.
            - If the input is already clean, return it as is.
            - Output ONLY the cleaned text.

            Input: "${text}"
            Cleaned Text:`;

            const cleaned = await LLMService.generateText(prompt, {
                workflow: 'text_cleaning',
                userId,
                temperature: 0.3 // Lower temperature for more deterministic cleaning
            });

            return cleaned.trim();
        } catch (error) {
            logger.error('Text cleaning failed', error);
            return text; // Fallback to original text
        }
    }
}

export const agentNLPService = new AgentNLPService();
