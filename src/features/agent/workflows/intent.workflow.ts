import { Types } from 'mongoose';
import { logger } from '../../../config/logger';
import { socketService } from '../../../core/socket/socket.service';
import { SocketEvents } from '../../../core/socket/socket.types';
import { entryService } from '../../entry/entry.service';
import { IAgentWorkflow } from '../agent.interfaces';
import { IAgentTaskDocument } from '../agent.model';
import { AgentTaskType } from '../agent.types';
import { intentDispatcher } from '../handlers/intent.dispatcher';
import { agentMemoryService } from '../memory/agent.memory';
import { agentIntentService, AgentIntentType } from '../services/agent.intent.service';
import agentService from '../services/agent.service';
import { entryEmbeddingWorkflow } from './embedding.workflow';
import { entityExtractionWorkflow } from './extraction.workflow';
import { taggingWorkflow } from './tagging.workflow';

export class IntentWorkflow implements IAgentWorkflow {
    public readonly type = AgentTaskType.INTENT_PROCESSING;

    private async updateStep(step: string, entryId: string, userId: string | Types.ObjectId) {
        logger.info(`[IntentWorkflow] Step: ${step} for entry ${entryId}`);
        const currentEntry = await entryService.getEntryById(entryId.toString(), userId);
        if (!currentEntry) return null;
        const entry = await entryService.updateEntry(entryId.toString(), userId, {
            status: 'processing',
            metadata: { ...currentEntry.metadata, processingStep: step }
        });
        socketService.emitToUser(userId.toString(), SocketEvents.ENTRY_UPDATED, entry);
        return entry;
    }

    async execute(task: IAgentTaskDocument): Promise<any> {
        const { userId } = task;
        const { text, entryId, options } = (task.inputData as any) || {};

        try {
            let entry = await entryService.getEntryById(entryId, userId);
            if (!entry) {
                logger.error(`[IntentWorkflow] Entry not found for intent processing ${entryId}`);
                return { status: 'failed', error: 'Entry not found' };
            }

            // 1. Intent Analysis
            await this.updateStep('analyzing_history', entryId, userId);
            let intentResult = options?.intentResult;
            if (!intentResult) {
                const history = await agentMemoryService.getHistory(userId);
                await this.updateStep('analyzing_intent', entryId, userId);
                try {
                    intentResult = await agentIntentService.classify(userId, text, history, options?.timezone);
                } catch (aiError) {
                    logger.warn("[IntentWorkflow] Intent analysis failed, falling back to journaling", aiError);
                    intentResult = {
                        intents: [{ intent: AgentIntentType.JOURNALING, parsedEntities: { date: new Date() } }],
                        summary: "Saved as daily entry"
                    };
                }
            }

            // Handle Clarification loops
            const clarification = intentResult.intents.find((i: any) => i.needsClarification);
            if (clarification) {
                entry = await entryService.updateEntry(entryId, userId, {
                    status: 'ready',
                    metadata: { ...entry.metadata, needsClarification: true, clarification }
                });
                socketService.emitToUser(userId.toString(), SocketEvents.ENTRY_UPDATED, entry);
                return {
                    status: 'completed',
                    result: { ...clarification, originalText: text, result: entry }
                };
            }

            await this.updateStep('storing_memory', entryId, userId);
            await agentMemoryService.addMessage(userId, 'user', text);

            // 2. Dispatch Principal Actions (Journaling, Goals, Reminders)
            await this.updateStep('executing_actions', entryId, userId);
            const dispatchResult = await intentDispatcher.dispatch({
                userId,
                text,
                entry,
                intentResult
            });

            if (dispatchResult.earlyReturn) {
                entry = await entryService.updateEntry(entryId, userId, { status: 'ready' });
                socketService.emitToUser(userId.toString(), SocketEvents.ENTRY_UPDATED, entry);
                return { status: 'completed', result: dispatchResult.earlyReturn };
            }

            // 3. Sequentially process remaining workflows

            // A. Tagging
            await this.updateStep('tagging', entryId, userId);
            try {
                await taggingWorkflow.execute(task);
            } catch (tagError) {
                logger.error(`[IntentWorkflow] Tagging failed for entry ${entryId}`, tagError);
            }

            // B. Extraction
            await this.updateStep('extracting_entities', entryId, userId);
            try {
                await entityExtractionWorkflow.execute(task);
            } catch (extError) {
                logger.error(`[IntentWorkflow] Extraction failed for entry ${entryId}`, extError);
            }

            // C. Embedding
            await this.updateStep('indexing', entryId, userId);
            try {
                await entryEmbeddingWorkflow.execute(task);
            } catch (embedError) {
                logger.error(`[IntentWorkflow] Embedding failed for entry ${entryId}`, embedError);
            }

            // 4. Final Cleanup
            entry = await entryService.getEntryById(entryId, userId); // Refresh final state
            entry = await entryService.updateEntry(entryId, userId, {
                status: 'ready',
                aiProcessed: true,
                metadata: { ...entry.metadata, processingStep: 'completed' }
            });

            const summary = dispatchResult.summary || `Processed ${intentResult.intents.length} intentions.`;
            await agentMemoryService.addMessage(userId, 'agent', summary);

            // Background Persona Sync
            agentService.triggerSynthesis(userId).catch(err => logger.error("Persona Synthesis trigger failed", err));

            socketService.emitToUser(userId.toString(), SocketEvents.ENTRY_UPDATED, entry);

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
                socketService.emitToUser(userId.toString(), SocketEvents.ENTRY_UPDATED, failedEntry);
            } catch (updateErr) {
                logger.error("Failed to update entry to failed status", updateErr);
            }
            return { status: 'failed', error: error.message || 'Unknown error' };
        }
    }
}

export const intentWorkflow = new IntentWorkflow();
