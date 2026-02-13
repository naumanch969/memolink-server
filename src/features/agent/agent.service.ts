import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { LLMService } from '../../core/llm/llm.service';
import Entry from '../entry/entry.model';
import { entryService } from '../entry/entry.service';
import { briefingService } from './agent.briefing';
import { AGENT_CONSTANTS } from './agent.constants';
import { AgentIntentType, IntentResult, agentIntent } from './agent.intent';
import { agentMemory } from './agent.memory';
import { AgentTask, IAgentTaskDocument } from './agent.model';
import { getAgentQueue } from './agent.queue';
import { AgentTaskStatus, AgentTaskType } from './agent.types';
import { intentDispatcher } from './handlers/intent.dispatcher';
import { chatOrchestrator } from './orchestrators/chat.orchestrator';
import { personaService } from './persona.service';

export class AgentService {
    /**
     * Creates a new agent task and adds it to the queue
     */
    async createTask(userId: string, type: AgentTaskType, inputData: any): Promise<IAgentTaskDocument> {
        // 1. Create DB Record
        const task = await AgentTask.create({
            userId,
            type,
            status: AgentTaskStatus.PENDING,
            inputData,
        });

        // 2. Add to Queue
        try {
            const queue = getAgentQueue();
            await queue.add(type, { taskId: task._id.toString() });
            logger.info(`Agent Task created: [${type}] ${task._id} for user ${userId}`);
        } catch (error) {
            logger.error('Failed to enqueue agent task', error);
            // Revert DB creation or mark as failed?
            // For now, mark as failed immediately
            task.status = AgentTaskStatus.FAILED;
            task.error = 'Failed to enqueue task';
            await task.save();
        }

        return task;
    }

    /**
     * Get a task by ID
     */
    async getTask(taskId: string, userId: string): Promise<IAgentTaskDocument | null> {
        return AgentTask.findOne({ _id: taskId, userId });
    }

    /**
     * List tasks for a user
     */
    async listUserTasks(userId: string, limit = 20): Promise<IAgentTaskDocument[]> {
        return AgentTask.find({ userId })
            .sort({ createdAt: -1 })
            .limit(limit);
    }

    async processNaturalLanguage(userId: string, text: string, options: { tags?: string[], timezone?: string } = {}): Promise<any> {
        // 1. PERSIST FIRST (The "Capture First" Reliability Pattern)
        let entry: any = null;
        try {
            entry = await entryService.createEntry(userId, {
                content: text,
                date: new Date(),
                type: 'text',
                status: 'captured', // New status for initial capture
                tags: options.tags || [],
                metadata: { source: 'capture-mode' }
            });
            logger.info("Reliability Capture: Entry saved to Mongo before AI processing", { userId, entryId: entry._id });
        } catch (saveError) {
            logger.error("Reliability Capture Failed: Could not save initial entry", saveError);
        }

        try {
            // 2. Get Context for AI
            const history = await agentMemory.getHistory(userId);

            // 3. AI Intent Analysis (Multi-Intent support)
            let intentResult: IntentResult;
            try {
                intentResult = await agentIntent.classify(text, history, options.timezone);
            } catch (aiError) {
                logger.error("AI Bottleneck: Intent classification failed, falling back to raw entry", aiError);
                intentResult = {
                    intents: [{ intent: AgentIntentType.JOURNALING, parsedEntities: { date: new Date() } }],
                    summary: "Saved as daily entry"
                };
            }

            // check for early returns from specific intentions (e.g. clarification)
            const clarificationIntention = intentResult.intents.find(i => i.needsClarification);
            if (clarificationIntention) {
                if (entry?._id) await entryService.updateEntry(entry._id.toString(), userId, { status: 'ready' });
                return {
                    ...clarificationIntention,
                    originalText: text,
                    result: entry
                };
            }

            // 4. Update Memory (User)
            await agentMemory.addMessage(userId, 'user', text);

            // 5. DELEGATED EXECUTION: Route based on Intent
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

            // 6. Create Task Records (Logging all actions)
            const tasks = [];
            for (const action of dispatchResult.actions) {
                const task = await this.createTask(userId, action.taskType, {
                    text,
                    intent: action.taskType, // approximation
                    resultId: action.commandObject?._id?.toString()
                });
                tasks.push(task);
            }

            // Final check: if no actions were taken (JOURNALING only), ensure status is ready
            if (dispatchResult.actions.length === 0 && entry?._id) {
                await entryService.updateEntry(entry._id.toString(), userId, { status: 'ready' });
            }

            // 7. Update Memory (Agent)
            const summary = dispatchResult.summary || `Processed ${intentResult.intents.length} intentions.`;
            await agentMemory.addMessage(userId, 'agent', summary);

            // 8. Trigger Persona Synthesis (Async / Throttled)
            personaService.triggerSynthesis(userId).catch(err => logger.error("Background Persona Synthesis Trigger failed", err));

            return {
                tasks,
                result: dispatchResult.actions.length > 0 ? dispatchResult.actions[0].commandObject : entry,
                summary
            };

        } catch (processError) {
            logger.error("Fail-Safe: Processing failed, manual recovery to library", processError);
            if (entry?._id) {
                await entryService.updateEntry(entry._id.toString(), userId, { status: 'ready' });
            }
            throw processError;
        }
    }

    /**
     * Conversational Agent with Tool Access (Enhanced with TAO Context)
     */
    async chat(userId: string, message: string): Promise<string> {
        // 1. Persist user message in memory
        await agentMemory.addMessage(userId, 'user', message);

        // 2. Delegate to Chat Orchestrator
        const response = await chatOrchestrator.chat(userId, message, {
            onFinish: async (finalAnswer) => {
                // Update Memory with Agent Response
                await agentMemory.addMessage(userId, 'agent', finalAnswer);

                // Trigger Persona Synthesis
                personaService.triggerSynthesis(userId).catch(err => logger.error("Background Persona Synthesis Trigger failed", err));

                // Trigger Recursive Memory Flush
                this.checkMemoryFlush(userId).catch(err => logger.error("Memory Flush check failed", err));
            }
        });

        return response;
    }

    /**
     * Checks if short-term memory is full and triggers a Recursive Flush if needed.
     */
    private async checkMemoryFlush(userId: string) {
        const history = await agentMemory.getHistory(userId);
        if (history.length >= AGENT_CONSTANTS.FLUSH_THRESHOLD) {
            logger.info(`Memory threshold reached for user ${userId} (${history.length} msgs). Enqueueing flush.`);
            await this.createTask(userId, AgentTaskType.MEMORY_FLUSH, { count: AGENT_CONSTANTS.FLUSH_COUNT });

            // Trigger Cognitive Consolidation to bridge chat memory into Persona KG
            await this.createTask(userId, AgentTaskType.COGNITIVE_CONSOLIDATION, {
                messageCount: AGENT_CONSTANTS.FLUSH_COUNT
            });
        }
    }

    async clearHistory(userId: string): Promise<void> {
        await agentMemory.clear(userId);
    }

    async getChatHistory(userId: string) {
        return await agentMemory.getHistory(userId);
    }

    /**
     * Generates a proactive briefing for the user (Chief of Staff greeting)
     */
    async getDailyBriefing(userId: string): Promise<string> {
        return briefingService.getDailyBriefing(userId);
    }

    /**
     * Finds semantically similar entries for a given text
     */
    async findSimilarEntries(userId: string, text: string, limit: number = 5): Promise<any[]> {
        try {
            const queryVector = await LLMService.generateEmbeddings(text);
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
                score: 0.5 // Estimated score
            }));

        } catch (error) {
            logger.error('Similar entries lookup failed', error);
            return [];
        }
    }

    async goalArchitect(userId: string, message: string, history: Array<{ role: string, content: string }>): Promise<string> {
        const historyText = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

        const prompt = `
            SYSTEM INSTRUCTION:
            You are an expert Goal Architect and Coaching AI. Your role is to help users operationalize their ambitions into concrete Goals and Routines.

            CONVERSATION HISTORY:
            ${historyText}
            USER: ${message}

            CONVERSATION STYLE:
            - Be concise and natural, like a human coach.
            - DO NOT interrogate the user with a wall of questions.
            - Ask ONE or TWO most critical clarifying questions at a time.
            - MATCH the user's energy. If they are brief, be brief. If they are detailed, match that depth.

            PHASE 1: INTELLIGENT DISCOVERY
            Analyze the user's input. Do you have enough context to build a robust system?
            Context needed:
            1. The specific OUTCOME/VISION (What exactly do they want to achieve?)
            2. The MOTIVATION (Why now? What's the driver?) - *Infer this if possible, or ask later.*
            3. The OBSTACLES (Optional, ask only if the goal seems hard).

            DECISION LOGIC:
            - IF the goal is trivial (e.g. "drink water"): SKIP discovery and propose a plan immediately.
            - IF the goal is broad (e.g. "get fit"): Ask ONE specific question to narrow it down (e.g. "Do you have a specific sport in mind, or just general health?").
            - IF the context is clear but missing details: Propose a "Draft Plan" and ask for feedback.

            PHASE 2: ARCHITECTURE (When ready)
            Once you have enough context, propose a "System" consisting of:
            - A High-Level Goal (The Outcome)
            - A Strategy (The Description/Approach)
            - Linked Routines (The Daily/Weekly input metrics)

            VALID TYPES for Routines (Strict):
            - boolean (Simple checkbox, e.g. "Wake up on time")
            - warning: 'checklist' is NOT supported for routines yet, use boolean or text.
            - counter (Numeric, e.g. "Drink 5 glasses", requires target)
            - duration (Time-based, e.g. "Read for 30 mins", requires target)
            - scale (1-10 rating, e.g. "Energy level")
            - text (Journaling/logging inputs)

            OUTPUT FORMAT:
            - If asking questions, just output the plain text question.
            - If proposing a plan, output the JSON ONLY within triple backticks like this:
            \`\`\`json
            {
              "title": "Become a Marathon Runner",
              "why": "To demonstrate resilience and mastery over my physical limits",
              "description": "A 16-week progressive training block culminating in the London Marathon.",
              "type": "counter", 
              "targetValue": 42.2, 
              "unit": "km",
              "deadline": "2024-12-31",
              "routines": [
                 { "name": "Zone 2 Training", "frequency": "daily", "type": "duration", "description": "45 min low heart rate run" },
                 { "name": "Long Run", "frequency": "weekly", "type": "duration", "description": "90+ min endurance run" },
                 { "name": "Recovery Sleep", "frequency": "daily", "type": "scale", "description": "Rate sleep quality 1-10" }
              ]
            }
            \`\`\`
        `;

        return await LLMService.generateText(prompt);
    }

    /**
     * Retroactively syncs/refines entries to ensure consistency across the library.
     * Uses an Orchestrator Task (LIBRARY_SYNC) to handle execution in a throttled, 
     * background-safe manner.
     */
    async syncEntries(userId: string, entryId?: string): Promise<{ taskId: string }> {
        // We create a SINGLE orchestrator task.
        // The Worker/Workflow (Sync Worker) will handle the chunking and cost-control.
        const task = await this.createTask(userId, AgentTaskType.SYNC, {
            entryId // Optional: if present, Sync Worker will prioritize this ID
        });

        logger.info(`Library sync request initiated for user ${userId}. TaskId: ${task._id}`);

        return { taskId: task._id.toString() };
    }

    /**
     * Triggers a deep persona synthesis for the user.
     * This analyzes the deep nature of the user (philosophy, psychology, patterns)
     * independently from standard entry enrichment.
     */
    async syncPersona(userId: string, force: boolean = false): Promise<{ taskId: string }> {
        const task = await this.createTask(userId, AgentTaskType.PERSONA_SYNTHESIS, { force });
        logger.info(`Persona sync initiated for user ${userId}. TaskId: ${task._id}`);
        return { taskId: task._id.toString() };
    }
}


export const agentService = new AgentService();
export default agentService;
