import { logger } from '../../config/logger';
import { getEnrichmentQueue } from './enrichment.queue';

export class EnrichmentService {
    async enqueueActiveEnrichment(userId: string, entryId: string, sessionId: string): Promise<void> {
        try {
            const queue = getEnrichmentQueue();
            await queue.add('process-active', {
                userId,
                sourceType: 'active',
                sessionId,
                referenceId: entryId
            });
            logger.info(`Enrichment Service: Enqueued task for entry ${entryId}`);
        } catch (error) {
            logger.error(`Enrichment Service: Failed to enqueue for ${entryId}`, error);
        }
    }

    async enqueuePassiveEnrichment(userId: string, sessionId: string): Promise<void> {
        logger.debug(`Enrichment Service: Passive enrichment triggered for session ${sessionId} - Feature pending.`);
    }
}

export const enrichmentService = new EnrichmentService();
export default enrichmentService;
