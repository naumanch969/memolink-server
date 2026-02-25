import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/llm.service';
import { Entry } from '../../entry/entry.model';
import { IAgentTaskDocument } from '../agent.model';
import { AgentTaskType, AgentWorkflowResult, IAgentWorkflow } from '../agent.types';

export class EntryEmbeddingWorkflow implements IAgentWorkflow {
    public readonly type = AgentTaskType.ENTRY_EMBEDDING;

    async execute(task: IAgentTaskDocument): Promise<AgentWorkflowResult> {
        const { entryId } = (task.inputData as any) || {};

        if (!entryId) {
            return { status: 'failed', error: 'Entry ID is required for embedding workflow' };
        }

        try {
            // 1. Fetch Entry
            const entry = await Entry.findById(entryId);
            if (!entry) {
                return { status: 'failed', error: `Entry ${entryId} not found` };
            }

            if (!entry.content) {
                logger.info(`Skipping embedding for entry ${entryId} due to no content`);
                return { status: 'completed', result: { skipped: true, reason: 'no content' } };
            }

            // 2. Generate Embeddings
            logger.info(`Generating embeddings for entry ${entryId}`);
            const embeddings = await LLMService.generateEmbeddings(entry.content, {
                workflow: 'entry_embedding',
                userId: task.userId,
            });

            if (embeddings.length == 0) {
                return { status: 'failed', error: `Embeddings generation failed for entry ${entryId}` };
            }

            // 3. Save to Entry
            await Entry.findByIdAndUpdate(entryId, {
                $set: { embeddings }
            });

            logger.info(`Embeddings saved for entry ${entryId}`);

            return {
                status: 'completed',
                result: { vectorSize: embeddings.length }
            };
        } catch (error: any) {
            logger.error(`Error in EntryEmbeddingWorkflow for entry ${entryId}:`, error);
            return { status: 'failed', error: error.message };
        }
    }
}

export const entryEmbeddingWorkflow = new EntryEmbeddingWorkflow();
