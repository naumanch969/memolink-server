import { Types } from 'mongoose';
import { logger } from '../../../config/logger';
import { Entry } from '../../entry/entry.model';
import { IAgentTaskDocument } from '../agent.model';
import { AgentTaskType, AgentWorkflowResult, IAgentWorkflow } from '../agent.types';
import agentService from '../services/agent.service';

export class SyncWorkflow implements IAgentWorkflow {
    public readonly type = AgentTaskType.SYNC;

    async execute(task: IAgentTaskDocument): Promise<AgentWorkflowResult> {
        const { userId, inputData } = task;
        const { entryId } = (inputData as any) || {};
        let processed = 0;

        try {
            if (entryId) {
                // High Priority: Single entry manual re-eval
                await this.enqueueEntryTasks(userId, entryId);
                return { status: 'completed', result: { processed: 1, remaining: 0 } };
            }

            // Low Priority: Batch maintenance
            const batchSize = 10;
            const entries = await Entry.find({
                userId: new Types.ObjectId(userId),
                content: { $exists: true, $ne: "" },
                status: { $nin: ['processed', 'processing'] }
            }).limit(batchSize);

            for (const entry of entries) {
                await this.enqueueEntryTasks(userId, entry._id.toString());
                processed++;
            }

            // Check how many are left for reporting
            const remaining = await Entry.countDocuments({
                userId: new Types.ObjectId(userId),
                content: { $exists: true, $ne: "" },
                status: { $nin: ['processed', 'processing'] }
            });

            logger.info(`Sync Worker processed ${processed} legacy entries. ${remaining} still pending.`);

            return { status: 'completed', result: { processed, remaining } };
        } catch (error: any) {
            logger.error(`Sync workflow failed for user ${userId}`, error);
            return { status: 'failed', error: error.message };
        }
    }

    private async enqueueEntryTasks(userId: string | Types.ObjectId, entryId: string) {
        // Rely on the central ENTRY_ENRICHMENT orchestrator rather than scattering sub-tasks.
        // The enrichment.workflow.ts natively calls tagging, extraction, and embedding sequentially.
        const entry = await Entry.findById(entryId).select('content').lean();
        await agentService.createTask(userId, AgentTaskType.ENTRY_ENRICHMENT, {
            entryId,
            text: entry?.content
        });
    }
}

export const syncWorkflow = new SyncWorkflow();
