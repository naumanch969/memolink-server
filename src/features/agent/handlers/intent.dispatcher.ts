import { Types } from 'mongoose';
import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/LLMService';
import { DataType } from '../../../shared/types';
import { entryService } from '../../entry/entry.service';
import { goalService } from '../../goal/goal.service';
import { graphService } from '../../graph/graph.service';
import reminderService from '../../reminder/reminder.service';
import { NotificationTimeType, ReminderPriority, ReminderStatus } from '../../reminder/reminder.types';
import { RoutineTemplate } from '../../routine/routine.model';
import { AgentIntentType, Intention, IntentResult } from '../agent.intent';
import { AgentTaskType } from '../agent.types';

export interface ExecuteParams {
    userId: string;
    text: string;
    entry: any; // The persisting entry
    intentResult: IntentResult;
}

export interface IntentAction {
    taskType: AgentTaskType;
    commandObject: any;
}

export interface IntentionExecutionResult {
    taskType: AgentTaskType; // Primary task type (first command or BRAIN_DUMP)
    actions: IntentAction[];
    finalResult: any;
    earlyReturn?: any;
    summary?: string;
}

export class IntentDispatcher {

    async dispatch(params: ExecuteParams): Promise<IntentionExecutionResult> {
        const { userId, text, entry, intentResult } = params;
        const actions: IntentAction[] = [];
        let finalResult = entry;

        // Process intents in order
        for (const intention of intentResult.intents) {
            const { intent } = intention;

            // Clarification check - if any intent needs it, we halt everything to avoid partial execution complexity
            if (intention.needsClarification) {
                return {
                    taskType: AgentTaskType.BRAIN_DUMP,
                    actions: [],
                    finalResult: entry,
                    earlyReturn: {
                        intent: intention.intent,
                        needsClarification: true,
                        missingInfos: intention.missingInfos,
                        originalText: text,
                        result: entry
                    }
                };
            }

            switch (intent) {
                case AgentIntentType.CMD_REMINDER_CREATE: {
                    const commandObject = await this.handleReminderCreate(userId, text, entry, intention);
                    actions.push({ taskType: AgentTaskType.REMINDER_CREATE, commandObject });
                    finalResult = null;
                    break;
                }
                case AgentIntentType.CMD_GOAL_CREATE: {
                    const commandObject = await this.handleGoalCreate(userId, text, entry, intention);
                    actions.push({ taskType: AgentTaskType.GOAL_CREATE, commandObject });
                    finalResult = null;
                    break;
                }
                case AgentIntentType.QUERY_KNOWLEDGE: {
                    const commandObject = await this.handleKnowledgeQuery(userId, text, entry);
                    actions.push({ taskType: AgentTaskType.KNOWLEDGE_QUERY, commandObject });
                    finalResult = null;
                    break;
                }
                case AgentIntentType.CMD_REMINDER_UPDATE: {
                    const updateRes = await this.handleReminderUpdate(userId, text, entry, intention);
                    if (updateRes?.earlyReturn) return updateRes as any;
                    actions.push({ taskType: AgentTaskType.REMINDER_UPDATE, commandObject: updateRes?.commandObject });
                    finalResult = null;
                    break;
                }
                case AgentIntentType.CMD_TASK_CREATE: {
                    const commandObject = await this.handleTaskCreate(userId, text, entry, intention);
                    actions.push({ taskType: AgentTaskType.REMINDER_CREATE, commandObject });
                    finalResult = null;
                    break;
                }
                case AgentIntentType.JOURNALING:
                    await this.handleJournaling(userId, entry, intention);
                    break;

                case AgentIntentType.UNKNOWN:
                    if (entry?._id) {
                        await entryService.updateEntry(entry._id.toString(), userId, { status: 'ready' });
                    }
                    return {
                        taskType: AgentTaskType.BRAIN_DUMP,
                        actions: [],
                        finalResult: entry,
                        earlyReturn: {
                            task: null,
                            result: entry,
                            intent: AgentIntentType.JOURNALING,
                            note: "Saved as general entry (unknown intent)"
                        }
                    };
            }
        }

        return {
            taskType: actions.length > 0 ? actions[0].taskType : AgentTaskType.BRAIN_DUMP,
            actions,
            finalResult,
            summary: intentResult.summary
        };
    }

    private async handleReminderCreate(userId: string, text: string, entry: any, intention: Intention) {
        const commandObject = await reminderService.createReminder(userId, {
            title: intention.extractedEntities?.title || text,
            date: intention.parsedEntities?.date?.toISOString() || new Date().toISOString(),
            priority: (intention.extractedEntities?.priority as ReminderPriority) || ReminderPriority.MEDIUM,
            notifications: {
                enabled: true,
                times: [{ type: NotificationTimeType.MINUTES, value: 15 }]
            },
            metadata: { originEntryId: entry?._id?.toString() }
        });

        // PROVENANCE LOCK: We no longer delete the entry.
        // We link it and set its status to ready so it remains in the library.
        if (entry?._id) {
            await entryService.updateEntry(entry._id.toString(), userId, {
                status: 'ready',
                metadata: { ...entry.metadata, convertedTo: 'reminder', relationId: commandObject._id }
            });
        }
        return commandObject;
    }

    private async handleGoalCreate(userId: string, text: string, entry: any, intention: Intention) {
        const meta = intention.extractedEntities?.metadata || {};
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
            title: intention.extractedEntities?.title || text,
            description: meta.description,
            why: meta.why,
            type: hasTargetValue ? DataType.COUNTER : DataType.CHECKLIST,
            priority: intention.extractedEntities?.priority || 'medium',
            reward: meta.reward,
            config: hasTargetValue ? { targetValue: meta.targetValue, unit: meta.unit || 'units' } : { items: [], allowMultiple: false },
            deadline: intention.parsedEntities?.date,
            linkedRoutines: linkedRoutineIds,
            metadata: { originEntryId: entry?._id?.toString() }
        } as any);

        // PROVENANCE LOCK
        if (entry?._id) {
            await entryService.updateEntry(entry._id.toString(), userId, {
                status: 'ready',
                metadata: { ...entry.metadata, convertedTo: 'goal', relationId: commandObject._id }
            });
        }
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

        // Even for queries, we keep the record of the interaction entry
        if (entry?._id) {
            await entryService.updateEntry(entry._id.toString(), userId, {
                status: 'ready',
                metadata: { ...entry.metadata, type: 'query' }
            });
        }
        return { answer };
    }

    private async handleReminderUpdate(userId: string, text: string, entry: any, intention: Intention) {
        let searchTitle = intention.extractedEntities?.title || text;
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
            if (intention.parsedEntities?.date) updateData.date = intention.parsedEntities.date.toISOString();
            if (intention.extractedEntities?.priority) updateData.priority = intention.extractedEntities.priority;
            const commandObject = await reminderService.updateReminder(userId, reminder._id, updateData);

            if (entry?._id) {
                await entryService.updateEntry(entry._id.toString(), userId, {
                    status: 'ready',
                    metadata: { ...entry.metadata, action: 'update_reminder', relationId: reminder._id }
                });
            }
            return { commandObject };
        } else {
            return {
                earlyReturn: {
                    intent: intention.intent,
                    needsClarification: true,
                    missingInfos: [`I couldn't find a task matching "${searchTitle}" to update.`],
                    originalText: text,
                    result: entry
                }
            };
        }
    }

    private async handleTaskCreate(userId: string, text: string, entry: any, intention: Intention) {
        const commandObject = await reminderService.createReminder(userId, {
            title: intention.extractedEntities?.title || text,
            date: new Date().toISOString(),
            allDay: true,
            priority: (intention.extractedEntities?.priority as ReminderPriority) || ReminderPriority.MEDIUM
        });

        if (entry?._id) {
            await entryService.updateEntry(entry._id.toString(), userId, {
                status: 'ready',
                metadata: { ...entry.metadata, convertedTo: 'task', relationId: commandObject._id }
            });
        }
        return commandObject;
    }

    private async handleJournaling(userId: string, entry: any, intention: any) {
        if (entry?._id) {
            await entryService.updateEntry(entry._id.toString(), userId, {
                date: intention.parsedEntities?.date || entry.date,
                status: 'ready'
            });
        }
    }

    /**
     * Finds semantically similar entries for a given text
     * (Duplicated from AgentService for now to keep IntentDispatcher independent)
     */
    private async findSimilarEntries(userId: string, text: string, limit: number = 5): Promise<any[]> {
        try {
            const queryVector = await LLMService.generateEmbeddings(text);
            try {
                const { default: Entry } = await import('../../entry/entry.model');
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
}

export const intentDispatcher = new IntentDispatcher();
