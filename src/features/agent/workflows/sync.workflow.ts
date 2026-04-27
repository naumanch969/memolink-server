import { Types } from 'mongoose';
import { logger } from '../../../config/logger';
import { Entry } from '../../entry/entry.model';
import { IAgentTaskDocument } from '../agent.model';
import { AgentTaskType, AgentWorkflowResult, IAgentWorkflow, ProgressCallback, WorkflowStatus } from '../agent.types';
import enrichmentService from '../../enrichment/enrichment.service';
import { EntryStatus } from '../../entry/entry.types';
import { SignalTier } from '../../enrichment/enrichment.types';

export class SyncWorkflow implements IAgentWorkflow {
    public readonly type = AgentTaskType.SYNC;

    async execute(task: IAgentTaskDocument, emitProgress: ProgressCallback, signal: AbortSignal): Promise<AgentWorkflowResult> {
        const { userId, inputData } = task;
        const { entryId } = (inputData as any) || {};
        let processed = 0;

        try {
            if (entryId) {
                // High Priority: Single entry manual re-eval
                await this.enqueueEntryTasks(userId, entryId);
                return { status: WorkflowStatus.COMPLETED, result: { processed: 1, remaining: 0 } };
            }

            // Low Priority: Batch maintenance
            const batchSize = 10;
            const entries = await Entry.find({
                userId: new Types.ObjectId(userId),
                content: { $exists: true, $ne: "" },
                status: { $nin: [EntryStatus.COMPLETED, EntryStatus.PROCESSING, EntryStatus.QUEUED] }
            }).limit(batchSize);

            for (const entry of entries) {
                if (signal.aborted) throw new Error('aborted');
                await this.enqueueEntryTasks(userId, entry._id.toString());
                processed++;
            }

            // Check how many are left for reporting
            const remaining = await Entry.countDocuments({
                userId: new Types.ObjectId(userId),
                content: { $exists: true, $ne: "" },
                status: { $nin: [EntryStatus.COMPLETED, EntryStatus.PROCESSING, EntryStatus.QUEUED] }
            });

            logger.info(`Sync Worker processed ${processed} legacy entries. ${remaining} still pending.`);

            return { status: WorkflowStatus.COMPLETED, result: { processed, remaining } };
        } catch (error: any) {
            if (error.message.includes('aborted')) {
                logger.warn(`SyncWorkflow aborted for user ${userId}`);
                return { status: WorkflowStatus.FAILED, error: 'Task aborted' };
            }
            logger.error(`Sync workflow failed for user ${userId}`, error);
            return { status: WorkflowStatus.FAILED, error: error.message };
        }
    }

    private async enqueueEntryTasks(userId: string | Types.ObjectId, entryId: string) {
        // Redirection: Move from AgentTask queue to specialized Enrichment queue
        const entry = await Entry.findById(entryId).select('content sessionId signalTier').lean();
        if (!entry) return;

        await enrichmentService.enqueueActiveEnrichment(
            userId.toString(),
            entryId,
            entry.sessionId || "",
            (entry.signalTier as any) || SignalTier.SIGNAL
        );
    }
}

export const syncWorkflow = new SyncWorkflow();
