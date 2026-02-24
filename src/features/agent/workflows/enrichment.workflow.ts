import { Types } from 'mongoose';
import { logger } from '../../../config/logger';
import { socketService } from '../../../core/socket/socket.service';
import { SocketEvents } from '../../../core/socket/socket.types';
import { entryService } from '../../entry/entry.service';
import { IAgentWorkflow } from '../agent.interfaces';
import { IAgentTaskDocument } from '../agent.model';
import { AgentTaskType } from '../agent.types';
import { agentMemoryService } from '../memory/agent.memory';
import agentService from '../services/agent.service';
import { entryEmbeddingWorkflow } from './embedding.workflow';
import { entityExtractionWorkflow } from './extraction.workflow';
import { taggingWorkflow } from './tagging.workflow';
import Entry from '../../entry/entry.model';

export class EnrichmentWorkflow implements IAgentWorkflow {
    public readonly type = AgentTaskType.ENTRY_ENRICHMENT;

    private async updateStep(step: string, entryId: string, userId: string | Types.ObjectId, task?: IAgentTaskDocument) {
        logger.info(`[EnrichmentWorkflow] Step: ${step} for entry ${entryId}`);

        // 1. Update Task for real-time queue view
        if (task) {
            task.inputData = { ...(task.inputData || {}), processingStep: step };
            await task.save();
            socketService.emitToUser(userId.toString(), SocketEvents.AGENT_TASK_UPDATED, task);
        }

        // 2. Efficiently update Entry status without triggering full Service logic (mood recalculation, etc)
        // This is strictly internal workflow state-keeping.
        const entry = await entryService.getEntryById(entryId, userId);
        if (!entry) return null;

        const updated = await Entry.findOneAndUpdate(
            { _id: entryId, userId: new Types.ObjectId(userId) },
            {
                $set: {
                    status: 'processing',
                    'metadata.processingStep': step
                }
            },
            { new: true }
        );

        if (updated) {
            socketService.emitToUser(userId.toString(), SocketEvents.ENTRY_UPDATED, updated);
        }

        return updated;
    }

    async execute(task: IAgentTaskDocument): Promise<any> {
        const { userId } = task;
        const { text, entryId } = (task.inputData as any) || {};

        try {
            let entry = await entryService.getEntryById(entryId, userId);
            if (!entry) {
                logger.error(`[EnrichmentWorkflow] Entry not found for enrichment ${entryId}`);
                return { status: 'failed', error: 'Entry not found' };
            }

            // 1. Unified Enrichment Pipeline (Sequentially process tasks)

            // A. Tagging
            await this.updateStep('tagging', entryId, userId, task);
            try {
                await taggingWorkflow.execute(task);
            } catch (tagError) {
                logger.error(`[EnrichmentWorkflow] Tagging failed for entry ${entryId}`, tagError);
            }

            // B. Extraction, TODO: re-implement it with minimal latency
            // await this.updateStep('extracting_entities', entryId, userId, task);
            // try {
            //     await entityExtractionWorkflow.execute(task);
            // } catch (extError) {
            //     logger.error(`[EnrichmentWorkflow] Extraction failed for entry ${entryId}`, extError);
            // }

            // C. Mood Analysis: TODO: implement it

            // D. Embedding
            await this.updateStep('indexing', entryId, userId, task);
            try {
                await entryEmbeddingWorkflow.execute(task);
            } catch (embedError) {
                logger.error(`[EnrichmentWorkflow] Embedding failed for entry ${entryId}`, embedError);
            }

            // 2. Final Cleanup
            entry = await entryService.getEntryById(entryId, userId); // Refresh final state
            entry = await entryService.updateEntry(entryId, userId, {
                status: 'ready',
                aiProcessed: true,
                metadata: { ...entry.metadata, processingStep: 'completed' }
            });

            const summary = "Journal entry enriched with metadata.";
            await agentMemoryService.addMessage(userId, 'agent', summary);

            // Background Persona Sync
            agentService.triggerSynthesis(userId).catch(err => logger.error("Persona Synthesis trigger failed", err));

            socketService.emitToUser(userId.toString(), SocketEvents.ENTRY_UPDATED, entry);

            return {
                status: 'completed',
                result: {
                    tasks: [],
                    result: entry,
                    summary
                }
            };

        } catch (error: any) {
            logger.error("[EnrichmentWorkflow] Failed to process enrichment", error);
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

export const enrichmentWorkflow = new EnrichmentWorkflow();
