import { logger } from '../../config/logger';
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
}


export const agentService = new AgentService();
