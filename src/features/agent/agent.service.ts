import { logger } from '../../config/logger';
import { LLMService } from '../../core/llm/LLMService';
import { DataType } from '../../shared/types';
import { entryService } from '../entry/entry.service';
import { goalService } from '../goal/goal.service';
import reminderService from '../reminder/reminder.service';
import { NotificationTimeType, ReminderPriority } from '../reminder/reminder.types';
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

    /**
     * Process natural language input, classify it, and route to the correct task
     */
    async processNaturalLanguage(userId: string, text: string): Promise<any> {
        // 1. Get Context
        const history = await agentMemory.getHistory(userId);

        const { intent, extractedEntities, parsedEntities } = await agentIntent.classify(text, history);

        // 3. Update Memory (User)
        await agentMemory.addMessage(userId, 'user', text);

        let result: any = null;
        let taskType = AgentTaskType.BRAIN_DUMP;

        // 4. Route based on Intent
        switch (intent) {
            case AgentIntentType.CMD_REMINDER_CREATE: {
                taskType = AgentTaskType.REMINDER_CREATE;
                // Create Reminder
                const reminderDate = parsedEntities?.date || new Date();
                if (extractedEntities?.time) {
                    // Simple parser for time if needed, or rely on chrono having caught it in date
                    // For now assuming chrono merged them if present
                }

                result = await reminderService.createReminder(userId, {
                    title: extractedEntities?.title || text,
                    date: reminderDate.toISOString(),
                    priority: (extractedEntities?.priority as ReminderPriority) || ReminderPriority.MEDIUM,
                    notifications: {
                        enabled: true,
                        times: [{ type: NotificationTimeType.MINUTES, value: 15 }]
                    }
                });
                break;
            }

            case AgentIntentType.CMD_GOAL_CREATE:
                taskType = AgentTaskType.GOAL_CREATE;
                // Create Goal
                result = await goalService.createGoal(userId, {
                    title: extractedEntities?.title || text,
                    type: DataType.CHECKLIST,
                    config: {
                        items: [],
                        allowMultiple: false
                    },
                    deadline: parsedEntities?.date
                });
                break;

            case AgentIntentType.CMD_TASK_CREATE:
                taskType = AgentTaskType.REMINDER_CREATE;
                // For now, treat generic tasks as Reminders without time (Todo)
                result = await reminderService.createReminder(userId, {
                    title: extractedEntities?.title || text,
                    date: new Date().toISOString(), // Today
                    allDay: true,
                    priority: (extractedEntities?.priority as ReminderPriority) || ReminderPriority.MEDIUM
                });
                break;

            case AgentIntentType.JOURNALING:
            default:
                taskType = AgentTaskType.BRAIN_DUMP;
                // Create Entry
                result = await entryService.createEntry(userId, {
                    content: text,
                    date: parsedEntities?.date || new Date(),
                    type: 'text'
                });
                break;
        }

        // 5. Create Task Record (Logging the action)
        const task = await this.createTask(userId, taskType, {
            text,
            intent,
            extractedEntities,
            resultId: result?._id?.toString()
        });

        // 6. Update Memory (Agent)
        await agentMemory.addMessage(userId, 'agent', `Processed ${intent}. Result ID: ${result?._id}`);

        // Return both the task record and the actual created object (Entry/Goal/Reminder)
        return { task, result, intent };
    }


    /**
     * Conversational Agent with Tool Access
     */
    async chat(userId: string, message: string): Promise<string> {
        // 1. Immediately persist user message to ensure it's captured
        await agentMemory.addMessage(userId, 'user', message);

        // 2. Get Context
        const history = await agentMemory.getHistory(userId);

        // Filter out the message we just added (if it appears in history) to avoid duplication in the prompt
        const previousHistory = history.filter(h => h.content !== message || h.timestamp < Date.now() - 1000);

        // Format history for context
        const promptHistory = previousHistory.map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n');

        const systemPrompt = `You are Memolink, an intelligent personal assistant.
        You have direct access to the user's data (entries, goals, reminders) via tools.
        Always verify successful tool execution.
        Today is ${new Date().toDateString()}.
        
        Recent Conversation:
        ${promptHistory}
        
        Current User Request: ${message}
        `;

        let currentPrompt = systemPrompt;
        let iteration = 0;
        const MAX_ITERATIONS = 5;

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
}


export const agentService = new AgentService();
