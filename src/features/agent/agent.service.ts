import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { LLMService } from '../../core/llm/LLMService';
import { DataType } from '../../shared/types';
import Entry from '../entry/entry.model';
import { entryService } from '../entry/entry.service';
import { goalService } from '../goal/goal.service';
import { graphService } from '../graph/graph.service';
import reminderService from '../reminder/reminder.service';
import { NotificationTimeType, ReminderPriority, ReminderStatus } from '../reminder/reminder.types';
import { RoutineTemplate } from '../routine/routine.model';
import { AgentIntentType, agentIntent } from './agent.intent';
import { agentMemory } from './agent.memory';
import { AgentTask, IAgentTaskDocument } from './agent.model';
import { getAgentQueue } from './agent.queue';
import { AgentTaskStatus, AgentTaskType } from './agent.types';
import { agentToolDefinitions, agentToolHandlers } from './tools';

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
        let result: any = null;
        try {
            result = await entryService.createEntry(userId, {
                content: text,
                date: new Date(),
                type: 'text',
                status: 'processing',
                tags: options.tags || [],
                metadata: { source: 'capture-mode' }
            });
            logger.info("Reliability Capture: Entry saved to Mongo before AI processing", { userId, entryId: result._id });
        } catch (saveError) {
            logger.error("Reliability Capture Failed: Could not save initial entry", saveError);
        }

        // 2. Get Context for AI
        const history = await agentMemory.getHistory(userId);

        // 3. AI Intent Analysis
        let intentResult;
        try {
            intentResult = await agentIntent.classify(text, history, options.timezone);
        } catch (aiError) {
            logger.error("AI Bottleneck: Intent classification failed, falling back to raw entry", aiError);
            intentResult = { intent: AgentIntentType.JOURNALING, parsedEntities: { date: new Date() } };
        }

        const { intent, needsClarification } = intentResult;

        if (needsClarification) {
            return {
                ...intentResult,
                originalText: text,
                result
            };
        }

        // 4. Update Memory (User)
        await agentMemory.addMessage(userId, 'user', text);

        // 5. Route based on Intent
        const { taskType, commandObject, finalResult, earlyReturn } = await this.executeIntent(userId, text, result, intentResult);

        if (earlyReturn) return earlyReturn;

        // 6. Create Task Record (Logging the action)
        const task = await this.createTask(userId, taskType, {
            text,
            intent,
            extractedEntities: intentResult.extractedEntities,
            resultId: (commandObject?._id || finalResult?._id)?.toString()
        });

        // 7. Update Memory (Agent)
        const actionLog = commandObject ? `Created ${taskType} (${commandObject._id})` : `Saved Entry (${finalResult?._id})`;
        await agentMemory.addMessage(userId, 'agent', `Processed ${intent}. ${actionLog}`);

        return { task, result: commandObject || finalResult, intent };
    }

    private async executeIntent(userId: string, text: string, entryResult: any, intentResult: any): Promise<any> {
        const { intent, extractedEntities, parsedEntities } = intentResult;
        let taskType = AgentTaskType.BRAIN_DUMP;
        let commandObject: any = null;
        let finalResult = entryResult;

        switch (intent) {
            case AgentIntentType.CMD_REMINDER_CREATE:
                taskType = AgentTaskType.REMINDER_CREATE;
                commandObject = await this.handleReminderCreate(userId, text, entryResult, intentResult);
                if (commandObject) finalResult = null;
                break;

            case AgentIntentType.CMD_GOAL_CREATE:
                taskType = AgentTaskType.GOAL_CREATE;
                commandObject = await this.handleGoalCreate(userId, text, entryResult, intentResult);
                if (commandObject) finalResult = null;
                break;

            case AgentIntentType.QUERY_KNOWLEDGE:
                taskType = AgentTaskType.KNOWLEDGE_QUERY;
                commandObject = await this.handleKnowledgeQuery(userId, text, entryResult);
                if (commandObject) finalResult = null;
                break;

            case AgentIntentType.CMD_REMINDER_UPDATE: {
                taskType = AgentTaskType.REMINDER_UPDATE;
                const updateRes = await this.handleReminderUpdate(userId, text, entryResult, intentResult);
                if (updateRes?.earlyReturn) return updateRes;
                commandObject = updateRes?.commandObject;
                if (commandObject) finalResult = null;
                break;
            }

            case AgentIntentType.CMD_TASK_CREATE:
                taskType = AgentTaskType.REMINDER_CREATE;
                commandObject = await this.handleTaskCreate(userId, text, entryResult, intentResult);
                if (commandObject) finalResult = null;
                break;

            case AgentIntentType.JOURNALING:
                await this.handleJournaling(userId, entryResult, intentResult);
                break;

            case AgentIntentType.UNKNOWN:
                if (entryResult?._id) {
                    await entryService.updateEntry(entryResult._id.toString(), userId, { status: 'ready' });
                }
                return { earlyReturn: { task: null, result: entryResult, intent: AgentIntentType.JOURNALING, note: "Saved as general entry (unknown intent)" } };
        }

        return { taskType, commandObject, finalResult };
    }

    private async handleReminderCreate(userId: string, text: string, entry: any, intent: any) {
        const commandObject = await reminderService.createReminder(userId, {
            title: intent.extractedEntities?.title || text,
            date: intent.parsedEntities?.date?.toISOString() || new Date().toISOString(),
            priority: (intent.extractedEntities?.priority as ReminderPriority) || ReminderPriority.MEDIUM,
            notifications: {
                enabled: true,
                times: [{ type: NotificationTimeType.MINUTES, value: 15 }]
            },
            metadata: { originEntryId: entry?._id?.toString() }
        });

        if (entry?._id) await entryService.deleteEntry(entry._id.toString(), userId);
        return commandObject;
    }

    private async handleGoalCreate(userId: string, text: string, entry: any, intent: any) {
        const meta = intent.extractedEntities?.metadata || {};
        const hasTargetValue = meta.targetValue !== undefined && meta.targetValue !== null;

        const linkedRoutineIds: string[] = [];
        if (meta.linkedRoutines?.length > 0) {
            const routines = await RoutineTemplate.find({
                userId: new Types.ObjectId(userId),
                name: { $in: meta.linkedRoutines.map((name: string) => new RegExp(`^${name}$`, 'i')) }
            }).select('_id').lean();
            routines.forEach(r => linkedRoutineIds.push(r._id.toString()));
        }

        const commandObject = await goalService.createGoal(userId, {
            title: intent.extractedEntities?.title || text,
            description: meta.description,
            why: meta.why,
            type: hasTargetValue ? DataType.COUNTER : DataType.CHECKLIST,
            priority: intent.extractedEntities?.priority || 'medium',
            reward: meta.reward,
            config: hasTargetValue ? { targetValue: meta.targetValue, unit: meta.unit || 'units' } : { items: [], allowMultiple: false },
            deadline: intent.parsedEntities?.date,
            linkedRoutines: linkedRoutineIds,
            metadata: { originEntryId: entry?._id?.toString() }
        } as any);

        if (entry?._id) await entryService.deleteEntry(entry._id.toString(), userId);
        return commandObject;
    }

    private async handleKnowledgeQuery(userId: string, text: string, entry: any) {
        const [contextEntries, graphContext] = await Promise.all([
            this.findSimilarEntries(userId, text, 5),
            graphService.getGraphSummary(userId)
        ]);

        const entriesContextText = contextEntries.map((e: any) => `[${new Date(e.date).toLocaleDateString()}] ${e.content}`).join('\n');
        const answer = await LLMService.generateText(`
            You are a helpful personal assistant.
            User Question: "${text}"
            
            Relevant Memories (Semantic):
            ${entriesContextText || "No relevant memories found."}

            Life Graph Context (Patterns & Goals):
            ${graphContext}
            
            Instructions:
            - Answer the question based on the provided memories and graph context.
            - If you don't know, say "I couldn't find that in your recent memories."
            - Be concise and friendly.
        `);

        if (entry?._id) await entryService.deleteEntry(entry._id.toString(), userId);
        return { answer };
    }

    private async handleReminderUpdate(userId: string, text: string, entry: any, intent: any) {
        let searchTitle = intent.extractedEntities?.title || text;
        searchTitle = searchTitle.replace(/^(that|the|my|this|a|it|task|reminder)\s+/i, '').trim();
        searchTitle = searchTitle.replace(/\s+(task|reminder|doc)$/i, '').trim();

        const { reminders } = await reminderService.getReminders(userId, {
            q: searchTitle,
            limit: 5,
            status: [ReminderStatus.PENDING]
        });

        if (reminders.length > 0) {
            const reminder = reminders[0];
            const updateData: any = {};
            if (intent.parsedEntities?.date) updateData.date = intent.parsedEntities.date.toISOString();
            if (intent.extractedEntities?.priority) updateData.priority = intent.extractedEntities.priority;
            const commandObject = await reminderService.updateReminder(userId, reminder._id, updateData);

            if (entry?._id) await entryService.deleteEntry(entry._id.toString(), userId);
            return { commandObject };
        } else {
            return {
                earlyReturn: {
                    intent: intent.intent,
                    needsClarification: true,
                    missingInfos: [`I couldn't find a task matching "${searchTitle}" to update.`],
                    originalText: text,
                    result: entry
                }
            };
        }
    }

    private async handleTaskCreate(userId: string, text: string, entry: any, intent: any) {
        const commandObject = await reminderService.createReminder(userId, {
            title: intent.extractedEntities?.title || text,
            date: new Date().toISOString(),
            allDay: true,
            priority: (intent.extractedEntities?.priority as ReminderPriority) || ReminderPriority.MEDIUM
        });

        if (entry?._id) await entryService.deleteEntry(entry._id.toString(), userId);
        return commandObject;
    }

    private async handleJournaling(userId: string, entry: any, intent: any) {
        if (entry?._id) {
            await entryService.updateEntry(entry._id.toString(), userId, {
                date: intent.parsedEntities?.date || entry.date,
                status: 'ready'
            });
        }
    }


    /**
     * Conversational Agent with Tool Access
     */
    async chat(userId: string, message: string): Promise<string> {
        // 1. Immediately persist user message to ensure it's captured
        await agentMemory.addMessage(userId, 'user', message);

        // 2. Get Context (History + Graph)
        const [history, graphContext] = await Promise.all([
            agentMemory.getHistory(userId),
            graphService.getGraphSummary(userId)
        ]);

        // Filter out the message we just added (if it appears in history) to avoid duplication in the prompt
        const previousHistory = history.filter(h => h.content !== message || h.timestamp < Date.now() - 1000);

        // Limit context to prevent token overflow
        const MAX_CONTEXT_MESSAGES = 15;
        const recentHistory = previousHistory.slice(-MAX_CONTEXT_MESSAGES);

        // Format history for context
        const promptHistory = recentHistory.map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n');

        const systemPrompt = `You are Memolink, an intelligent personal assistant.
        You have direct access to the user's data (entries, goals, reminders) via tools.
        Always verify successful tool execution.
        Today is ${new Date().toDateString()}.

        USER'S LIFE CONTEXT (Graph Summary):
        ${graphContext}
        
        Recent Conversation:
        ${promptHistory}
        
        Current User Request: ${message}

        RESPONSE FORMATTING:
        - Use standard Markdown.
        - When listing items (reminders, tasks, etc.), ALWAYS use a bulleted list.
        - ENSURE each bullet point is on a NEW LINE.
        - Bold key information like dates or titles.

        BROAD QUERIES:
        - If the user asks for a broad summary (e.g., "past year overview"), DO NOT try to fetch ALL data.
        - Fetch a sample (e.g., search with a limit of 20) or use 'find_similar_entries' for key themes.
        - explicitly state you are analyzing a sample of the data.
        `;

        let currentPrompt = systemPrompt;
        let iteration = 0;
        const MAX_ITERATIONS = 10;

        try {
            // Loop for ReAct / Tool use
            while (iteration < MAX_ITERATIONS) {
                iteration++;

                // Call LLM
                const response = await LLMService.generateWithTools(currentPrompt, {
                    tools: agentToolDefinitions
                });

                // Check for Function Calls
                if (response.functionCalls && response.functionCalls.length > 0) {
                    // Execute Tools
                    const toolOutputs = [];
                    for (const call of response.functionCalls) {
                        const fnName = call.name;
                        const args = call.args;

                        logger.info(`Agent executing tool: ${fnName}`, { userId, args });

                        if (agentToolHandlers[fnName]) {
                            try {
                                const output = await agentToolHandlers[fnName](userId, args);
                                toolOutputs.push({ name: fnName, output: output, status: 'success' });
                            } catch (err: any) {
                                toolOutputs.push({ name: fnName, error: err.message, status: 'error' });
                            }
                        } else {
                            toolOutputs.push({ name: fnName, error: 'Tool not found', status: 'error' });
                        }
                    }

                    // Append result to prompt and allow LLM to reason on it
                    currentPrompt += `\n\n[System] Tool Execution Results:\n`;
                    for (const t of toolOutputs) {
                        if (t.status === 'success') {
                            currentPrompt += `Tool '${t.name}' (Success): ${JSON.stringify(t.output)}\n`;
                        } else {
                            currentPrompt += `Tool '${t.name}' (Error): ${t.error}\n`;
                        }
                    }
                    currentPrompt += `\nBased on these results, please provide the final answer to the user or call another tool if needed.\n`;

                } else if (response.text) {
                    // Explicit termination: No valid tool calls, and we have text.
                    const finalAnswer = response.text;

                    // Update Memory with Agent Response
                    await agentMemory.addMessage(userId, 'agent', finalAnswer);

                    return finalAnswer;
                } else {
                    // Fallback: No text, no tools?
                    return "I'm unsure how to proceed. Could you rephrase that?";
                }
            }

            // Reached MAX_ITERATIONS
            return "I've been working on this for a while but couldn't finish. Please check the recent items.";

        } catch (error) {
            logger.error('Agent chat loop failed', error);
            return "I'm sorry, I encountered an error while processing your request.";
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
        try {
            // 1. Fetch Context
            const now = new Date();
            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(now.getDate() - 2);

            const [entriesData, upcomingReminders, overdueReminders, goals] = await Promise.all([
                entryService.searchEntries(userId, { dateFrom: twoDaysAgo.toISOString(), limit: 5 }),
                reminderService.getUpcomingReminders(userId, 15),
                reminderService.getOverdueReminders(userId),
                goalService.getGoals(userId, {}),
            ]);

            const entries = entriesData.entries || [];

            // 2. Process Reminders
            const todayStr = now.toDateString();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toDateString();

            const todayReminders: any[] = [];
            const futureReminders: any[] = [];

            (upcomingReminders || []).forEach((r: any) => {
                const rDate = new Date(r.date).toDateString();
                if (rDate === todayStr) {
                    todayReminders.push(r);
                } else {
                    futureReminders.push(r);
                }
            });

            // 3. Prepare Context for LLM
            const entryContext = entries.map(e => `- [${new Date(e.date).toLocaleDateString()}] ${e.content}`).join('\n');
            const goalContext = goals.map(g => `- ${g.title} (${g.status})`).join('\n');

            const overdueContext = (overdueReminders || []).map((r: any) => `- [OVERDUE: ${new Date(r.date).toLocaleDateString()}] ${r.title}`).join('\n');
            const todayContext = todayReminders.map(r => `- [TODAY] ${r.title} ${r.startTime ? `@ ${r.startTime}` : '(All Day)'}`).join('\n');
            const futureContext = futureReminders.map(r => `- [${new Date(r.date).toLocaleDateString()}] ${r.title} ${r.startTime ? `@ ${r.startTime}` : ''}`).join('\n');

            const prompt = `
            You are the "Chief of Staff" for a user in the MemoLink application.
            It is currently ${now.toDateString()}. 
            
            Based on the following data, provide a structured daily briefing.
            
            CRITICAL INSTRUCTIONS:
            1. **Tone**: DIRECT, PROACTIVE, and EFFICIENT. No fluff, no sugarcoating. Focus purely on execution and clarity. Avoid phrases like "Rise and shine" or excessive exclamation marks.
            2. **Structure**:
               - **Greeting**: Brief and functional based on the current time (e.g., "Good morning.").
               - **Today's Mission**: List essential tasks for TODAY. 
                 *IMPORTANT*: Check "RECENT LOGS" for any section titled "Plan for Tomorrow" or similar from yesterday's entries. These are high-priority tasks the user set for themselves. Merge them with the specific scheduled tasks.
               - **Goal Pulse**: succinct reminder of active goals and their relevance to today.
               - **Daily Boost**: A short quote relevant to productivity.
            
            DATA:
            RECENT LOGS (Check here for "Plan for Tomorrow"):
            ${entryContext || 'No recent logs.'}
            
            OVERDUE TASKS:
            ${overdueContext || 'None.'}
            
            SCHEDULE FOR TODAY (${todayStr}):
            ${todayContext || 'No specific tasks scheduled for today.'}
            
            UPCOMING:
            ${futureContext || 'No upcoming tasks found.'}
            
            ACTIVE GOALS:
            ${goalContext || 'No active goals - Encourage them to set one!'}
            
            Briefing:
            `;

            const briefing = await LLMService.generateText(prompt);
            return briefing;
        } catch (error) {
            logger.error('Failed to generate daily briefing', error);
            return "Good morning. I was unable to compile your full briefing at this time. Please check your dashboard for details.";
        }
    }

    /**
     * Finds semantically similar entries for a given text
     */
    async findSimilarEntries(userId: string, text: string, limit: number = 5): Promise<any[]> {
        try {
            // 1. Generate Query Embedding
            const queryVector = await LLMService.generateEmbeddings(text);

            // 2. Perform Vector Search (Atlas)
            // TODO: This requires a 'vector_index' to be defined in Atlas on the 'entries' collection

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

            // Fallback to text search
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
}


export const agentService = new AgentService();
export default agentService;
