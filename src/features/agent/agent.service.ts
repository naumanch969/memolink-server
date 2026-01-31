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
        // Ensure data is in Mongo immediately. This solves the speed/reliability bottleneck.
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
            // We continue anyway to try AI, though this shouldn't happen
        }

        // 2. Get Context for AI (Parallelize if possible, but keeping logic clear)
        const history = await agentMemory.getHistory(userId);

        // 3. AI Intent Analysis (The Potential Bottleneck)
        let intentResult;
        try {
            intentResult = await agentIntent.classify(text, history, options.timezone);
        } catch (aiError) {
            logger.error("AI Bottleneck: Intent classification failed, falling back to raw entry", aiError);
            // Fallback to raw journaling intent since we already saved it
            intentResult = { intent: AgentIntentType.JOURNALING, parsedEntities: { date: new Date() } };
        }

        const { intent, extractedEntities, parsedEntities, needsClarification, missingInfos } = intentResult;

        if (needsClarification) {
            return {
                intent,
                needsClarification: true,
                missingInfos,
                originalText: text,
                result // Return the entry we saved so the user knows it's captured
            };
        }

        // 4. Update Memory (User)
        await agentMemory.addMessage(userId, 'user', text);

        let taskType = AgentTaskType.BRAIN_DUMP;
        let commandObject: any = null;

        // 5. Route based on Intent
        // If it's a command, we keep the entry as a log but create the specific object
        switch (intent) {
            case AgentIntentType.CMD_REMINDER_CREATE: {
                taskType = AgentTaskType.REMINDER_CREATE;
                commandObject = await reminderService.createReminder(userId, {
                    title: extractedEntities?.title || text,
                    date: parsedEntities?.date?.toISOString() || new Date().toISOString(),
                    priority: (extractedEntities?.priority as ReminderPriority) || ReminderPriority.MEDIUM,
                    notifications: {
                        enabled: true,
                        times: [{ type: NotificationTimeType.MINUTES, value: 15 }]
                    },
                    metadata: { originEntryId: result?._id?.toString() }
                });

                // Remove the raw entry since it was successfully converted to a reminder
                if (result?._id) {
                    await entryService.deleteEntry(result._id.toString(), userId);
                    result = null; // Clear result so we don't return the deleted entry
                }
                break;
            }

            case AgentIntentType.CMD_GOAL_CREATE:
                taskType = AgentTaskType.GOAL_CREATE;
                commandObject = await goalService.createGoal(userId, {
                    title: extractedEntities?.title || text,
                    type: DataType.CHECKLIST,
                    config: {
                        items: [],
                        allowMultiple: false
                    },
                    deadline: parsedEntities?.date,
                    metadata: { originEntryId: result?._id?.toString() }
                });

                // Remove the raw entry since it was successfully converted to a goal
                if (result?._id) {
                    await entryService.deleteEntry(result._id.toString(), userId);
                    result = null;
                }
                break;

            case AgentIntentType.QUERY_KNOWLEDGE: {
                taskType = AgentTaskType.KNOWLEDGE_QUERY;
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

                commandObject = { answer };

                // Remove the query log from journal entries
                if (result?._id) {
                    await entryService.deleteEntry(result._id.toString(), userId);
                    result = null;
                }
                break;
            }

            case AgentIntentType.CMD_REMINDER_UPDATE: {
                taskType = AgentTaskType.REMINDER_UPDATE;
                let searchTitle = extractedEntities?.title || text;
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
                    if (parsedEntities?.date) updateData.date = parsedEntities.date.toISOString();
                    if (extractedEntities?.priority) updateData.priority = extractedEntities.priority;
                    commandObject = await reminderService.updateReminder(userId, reminder._id, updateData);

                    // Remove the raw entry since it was an update command
                    if (result?._id) {
                        await entryService.deleteEntry(result._id.toString(), userId);
                        result = null;
                    }

                } else {
                    return {
                        intent,
                        needsClarification: true,
                        missingInfos: [`I couldn't find a task matching "${searchTitle}" to update.`],
                        originalText: text,
                        result
                    };
                }
                break;
            }

            case AgentIntentType.CMD_TASK_CREATE:
                taskType = AgentTaskType.REMINDER_CREATE;
                commandObject = await reminderService.createReminder(userId, {
                    title: extractedEntities?.title || text,
                    date: new Date().toISOString(),
                    allDay: true,
                    priority: (extractedEntities?.priority as ReminderPriority) || ReminderPriority.MEDIUM
                });

                // Remove the raw entry since it was successfully converted
                if (result?._id) {
                    await entryService.deleteEntry(result._id.toString(), userId);
                    result = null;
                }
                break;

            case AgentIntentType.JOURNALING:
                taskType = AgentTaskType.BRAIN_DUMP;
                // We already saved the entry! 
                // Just update it if the AI parsed a different date or extracted metadata
                // Just update it if the AI parsed a different date or extracted metadata
                if (result?._id) {
                    await entryService.updateEntry(result._id.toString(), userId, {
                        date: parsedEntities?.date || result.date,
                        status: 'ready'
                    });
                }
                break;

            case AgentIntentType.UNKNOWN:
                // It's already saved as an entry, mark it ready
                if (result?._id) {
                    await entryService.updateEntry(result._id.toString(), userId, { status: 'ready' });
                }
                return { task: null, result, intent: AgentIntentType.JOURNALING, note: "Saved as general entry (unknown intent)" };
        }

        // 6. Create Task Record (Logging the action)
        const task = await this.createTask(userId, taskType, {
            text,
            intent,
            extractedEntities,
            resultId: (commandObject?._id || result?._id)?.toString()
        });

        // 7. Update Memory (Agent) - Log the final outcome
        const actionLog = commandObject ? `Created ${taskType} (${commandObject._id})` : `Saved Entry (${result?._id})`;
        await agentMemory.addMessage(userId, 'agent', `Processed ${intent}. ${actionLog}`);

        // Return the primary result (the specific command object if created, otherwise the entry)
        return { task, result: commandObject || result, intent };
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
            
            Based on the following data, provide a professional, objective, and executive daily briefing.
            
            CRITICAL INSTRUCTIONS:
            1. **Tone**: Be professional, concise, and objective. Avoid excessive optimism, cheerleading, or "fluff". Be direct.
            2. **Schedule Accuracy**: accurately distinguish between what is happening TODAY versus what is upcoming.
            3. **Structure**:
               - Greeting: Simple and professional (e.g., "Good morning. Here is your briefing for [Date].")
               - Review: Very brief summary of recent logs/entries (if any).
               - Action Items (Today): Strictly list reminders for TODAY.
               - Outlook: Briefly mention key upcoming items or overdue tasks if critical.
               - Goals: Mention top active goal.
            
            DATA:
            RECENT LOGS:
            ${entryContext || 'No recent logs.'}
            
            OVERDUE TASKS (Action Required):
            ${overdueContext || 'None.'}
            
            SCHEDULE FOR TODAY (${todayStr}):
            ${todayContext || 'No specific tasks scheduled for today.'}
            
            UPCOMING (Future):
            ${futureContext || 'No upcoming tasks found.'}
            
            ACTIVE GOALS:
            ${goalContext || 'No active goals.'}
            
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
