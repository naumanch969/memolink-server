import { logger } from '../../../config/logger';
import { socketService } from '../../../core/socket/socket.service';
import { SocketEvents } from '../../../core/socket/socket.types';
import { entryService } from '../../entry/entry.service';
import { agentTaskService } from '../agent-task.service';
import { agentIntent, AgentIntentType } from '../agent.intent';
import { agentMemory } from '../agent.memory';
import { IAgentTask } from '../agent.types';
import { intentDispatcher } from '../handlers/intent.dispatcher';
import { personaService } from '../persona.service';

export const runIntentProcessing = async (task: IAgentTask) => {
    const { userId } = task;
    const { text, entryId, options } = task.inputData;

    try {
        let entry = await entryService.getEntryById(entryId, userId);
        if (!entry) {
            logger.error(`[IntentWorkflow] Entry not found for intent processing ${entryId}`);
            return { status: 'failed', error: 'Entry not found' };
        }

        const history = await agentMemory.getHistory(userId);

        // 2. AI Intent Analysis
        let intentResult;
        try {
            intentResult = await agentIntent.classify(userId, text, history, options?.timezone);
        } catch (aiError) {
            logger.warn("[IntentWorkflow] Intent analysis failed, falling back to journaling", aiError);
            intentResult = {
                intents: [{ intent: AgentIntentType.JOURNALING, parsedEntities: { date: new Date() } }],
                summary: "Saved as daily entry"
            };
        }

        // Handle Clarification loops
        const clarification = intentResult.intents.find((i: any) => i.needsClarification);
        if (clarification) {
            entry = await entryService.updateEntry(entryId, userId, { status: 'ready' });
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, entry);
            return {
                status: 'completed',
                result: { ...clarification, originalText: text, result: entry }
            };
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
            entry = await entryService.updateEntry(entryId, userId, { status: 'ready' });
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, entry);
            return { status: 'completed', result: dispatchResult.earlyReturn };
        }

        // 4. Record Tasks for Actions
        const tasks = [];
        for (const action of dispatchResult.actions) {
            const newAgentTask = await agentTaskService.createTask(userId, action.taskType, {
                text,
                intent: action.taskType,
                resultId: action.commandObject?._id?.toString()
            });
            tasks.push(newAgentTask);
        }

        // Cleanup: Mark entry ready using dispatchResult if updated, otherwise just set status
        entry = await entryService.updateEntry(entryId, userId, { status: 'ready' });

        const summary = dispatchResult.summary || `Processed ${intentResult.intents.length} intentions.`;
        await agentMemory.addMessage(userId, 'agent', summary);

        // Background Persona Sync
        personaService.triggerSynthesis(userId).catch(err => logger.error("Persona Synthesis trigger failed", err));

        const finalResult = {
            tasks,
            result: dispatchResult.actions.length > 0 ? dispatchResult.actions[0].commandObject : entry,
            summary
        };

        // Emit updated entry securely
        socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, entry);

        return { status: 'completed', result: finalResult };

    } catch (error: any) {
        logger.error("[IntentWorkflow] Failed to process intent", error);

        // Update entry status to failed so UI can indicate it
        try {
            const failedEntry = await entryService.updateEntry(entryId, userId, { status: 'failed' });
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, failedEntry);
        } catch (updateErr) {
            logger.error("Failed to update entry to failed status", updateErr);
        }

        return { status: 'failed', error: error.message || 'Unknown error' };
    }
};
