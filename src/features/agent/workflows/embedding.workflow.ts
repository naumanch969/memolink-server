import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/LLMService';
import { Entry } from '../../entry/entry.model';
import { IAgentTask } from '../agent.types';

export const runEntryEmbedding = async (task: IAgentTask) => {
    const { entryId } = task.inputData;

    if (!entryId) {
        throw new Error('Entry ID is required for embedding workflow');
    }

    try {
        // 1. Fetch Entry
        const entry = await Entry.findById(entryId);
        if (!entry) {
            throw new Error(`Entry ${entryId} not found`);
        }

        if (!entry.content) {
            logger.info(`Skipping embedding for entry ${entryId} due to no content`);
            return { status: 'skipped', reason: 'no content' };
        }

        // 2. Generate Embeddings
        logger.info(`Generating embeddings for entry ${entryId}`);
        const embeddings = await LLMService.generateEmbeddings(entry.content);

        // 3. Save to Entry
        // We use findOneAndUpdate to avoid issues with versioning if entry was modified
        await Entry.findByIdAndUpdate(entryId, {
            $set: { embeddings }
        });

        logger.info(`Embeddings saved for entry ${entryId}`);

        return {
            status: 'completed',
            vectorSize: embeddings.length
        };
    } catch (error: any) {
        logger.error(`Error in runEntryEmbedding for entry ${entryId}:`, error);
        throw error;
    }
};
