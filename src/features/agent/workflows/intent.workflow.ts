import { Types } from 'mongoose';
import { logger } from '../../../config/logger';
import { socketService } from '../../../core/socket/socket.service';
import { SocketEvents } from '../../../core/socket/socket.types';
import { entryService } from '../../entry/entry.service';
import { agentIntent, AgentIntentType } from '../agent.intent';
import { agentMemory } from '../agent.memory';
import agentService from '../agent.service';
import { IAgentTask } from '../agent.types';
import { intentDispatcher } from '../handlers/intent.dispatcher';

const updateStep = async (step: string, entryId: string, userId: string | Types.ObjectId) => {
    logger.info(`[IntentWorkflow] Step: ${step} for entry ${entryId}`);
    const entry = await entryService.updateEntry(entryId, userId, {
        status: 'processing',
        metadata: { processingStep: step }
    });
    socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, entry);
    return entry;
};

export const runIntentProcessing = async (task: IAgentTask) => {
    const { userId } = task;
    const { text, entryId, options } = task.inputData;

    try {
        console.log('1. Intent Workflow started')
        let entry = await entryService.getEntryById(entryId, userId);
        if (!entry) {
            logger.error(`[IntentWorkflow] Entry not found for intent processing ${entryId}`);
            return { status: 'failed', error: 'Entry not found' };
        }

        console.log('2. Entry found')
        // 1. Intent Analysis
        await updateStep('analyzing_intent', entryId, userId);
        let intentResult = options?.intentResult;
        if (!intentResult) {
            const history = await agentMemory.getHistory(userId);
            try {
                intentResult = await agentIntent.classify(userId, text, history, options?.timezone);
            } catch (aiError) {
                logger.warn("[IntentWorkflow] Intent analysis failed, falling back to journaling", aiError);
                intentResult = {
                    intents: [{ intent: AgentIntentType.JOURNALING, parsedEntities: { date: new Date() } }],
                    summary: "Saved as daily entry"
                };
            }
        }

        console.log('3. Intent Analysis completed')
        // Handle Clarification loops
        const clarification = intentResult.intents.find((i: any) => i.needsClarification);
        if (clarification) {
            entry = await entryService.updateEntry(entryId, userId, {
                status: 'ready',
                metadata: { ...entry.metadata, needsClarification: true, clarification }
            });
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, entry);
            return {
                status: 'completed',
                result: { ...clarification, originalText: text, result: entry }
            };
        }

        console.log('4. Adding message to memory')
        await agentMemory.addMessage(userId, 'user', text);

        console.log('5. Dispatching actions')
        // 2. Dispatch Principal Actions (Journaling, Goals, Reminders)
        await updateStep('executing_actions', entryId, userId);
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

        console.log('6. Dispatching actions completed')
        // 3. Sequentially process remaining workflows

        // A. Tagging
        await updateStep('tagging', entryId, userId);
        try {
            const { runEntryTagging } = await import('./tagging.workflow');
            await runEntryTagging(userId, { entryId, content: text });
        } catch (tagError) {
            logger.error(`[IntentWorkflow] Tagging failed for entry ${entryId}`, tagError);
        }

        // B. Extraction
        await updateStep('extracting_entities', entryId, userId);
        try {
            const { runEntityExtraction } = await import('./extraction.workflow');
            await runEntityExtraction(task);
        } catch (extError) {
            logger.error(`[IntentWorkflow] Extraction failed for entry ${entryId}`, extError);
        }

        // C. Embedding
        await updateStep('indexing', entryId, userId);
        try {
            const { runEntryEmbedding } = await import('./embedding.workflow');
            await runEntryEmbedding(task);
        } catch (embedError) {
            logger.error(`[IntentWorkflow] Embedding failed for entry ${entryId}`, embedError);
        }

        console.log('7. Tagging, Extraction, Embedding completed')
        // 4. Final Cleanup
        entry = await entryService.getEntryById(entryId, userId); // Refresh final state
        entry = await entryService.updateEntry(entryId, userId, {
            status: 'ready',
            aiProcessed: true,
            metadata: { ...entry.metadata, processingStep: 'completed' }
        });

        const summary = dispatchResult.summary || `Processed ${intentResult.intents.length} intentions.`;
        await agentMemory.addMessage(userId, 'agent', summary);

        console.log('8. Final Cleanup completed')
        // Background Persona Sync
        agentService.triggerSynthesis(userId).catch(err => logger.error("Persona Synthesis trigger failed", err));

        socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, entry);

        console.log('9. Intent Workflow completed')
        return {
            status: 'completed',
            result: {
                tasks: [],
                result: dispatchResult.actions.length > 0 ? dispatchResult.actions[0].commandObject : entry,
                summary
            }
        };

    } catch (error: any) {
        logger.error("[IntentWorkflow] Failed to process intent", error);
        try {
            const failedEntry = await entryService.updateEntry(entryId, userId, { status: 'failed' });
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, failedEntry);
        } catch (updateErr) {
            logger.error("Failed to update entry to failed status", updateErr);
        }
        return { status: 'failed', error: error.message || 'Unknown error' };
    }
};
