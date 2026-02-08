import { Types } from 'mongoose';
import { logger } from '../../../config/logger';
import { Entry } from '../../entry/entry.model';
import { agentService } from '../agent.service';
import { AgentTaskType } from '../agent.types';

/**
 * The Sync Workflow: A throttled, background process that ensures
 * all library entries are eventually enhanced with AI.
 */
export async function runSyncWorkflow(userId: string, inputData: { entryId?: string } = {}): Promise<{ processed: number, remaining: number }> {
    const { entryId } = inputData;
    let processed = 0;

    if (entryId) {
        // High Priority: Single entry manual re-eval
        await enqueueEntryTasks(userId, entryId);
        return { processed: 1, remaining: 0 };
    }

    // Low Priority: Batch maintenance
    // We only process a small chunk (e.g., 10) per worker execution 
    // to prevent rate-limiting and cost spikes.
    const batchSize = 10;
    const entries = await Entry.find({
        userId: new Types.ObjectId(userId),
        content: { $exists: true, $ne: "" },
        $or: [
            { tags: { $size: 0 } },
            { embeddings: { $exists: false } }
        ]
    }).limit(batchSize);

    for (const entry of entries) {
        await enqueueEntryTasks(userId, entry._id.toString());
        processed++;
    }

    // Check how many are left for reporting
    const remaining = await Entry.countDocuments({
        userId: new Types.ObjectId(userId),
        content: { $exists: true, $ne: "" },
        $or: [
            { tags: { $size: 0 } },
            { embeddings: { $exists: false } }
        ]
    });

    logger.info(`Sync Worker processed ${processed} legacy entries. ${remaining} still pending.`);

    // If more remain, we COULD auto-schedule another sync task with a delay
    // but for now, we leave it for the next manual trigger or CRON.
    return { processed, remaining };
}

async function enqueueEntryTasks(userId: string, entryId: string) {
    // We use the central service to ensure consistent task creation
    await Promise.all([
        agentService.createTask(userId, AgentTaskType.ENTRY_TAGGING, { entryId }),
        agentService.createTask(userId, AgentTaskType.PEOPLE_EXTRACTION, { entryId, userId }),
        agentService.createTask(userId, AgentTaskType.EMBED_ENTRY, { entryId })
    ]);
}
