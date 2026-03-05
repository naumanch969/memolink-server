import { logger } from '../../config/logger';
import { queueService } from '../../core/queue/queue.service';

export const ENRICHMENT_QUEUE_NAME = 'enrichment-queue';

export interface EnrichmentJobData {
    userId: string;
    sourceType: 'active' | 'passive';
    sessionId: string;
    referenceId?: string; // e.g. Entry ID
}

/**
 * EnrichmentService: Entryway to the AI Pipeline
 */
export class EnrichmentService {
    /**
     * Enqueues an enrichment task – elevates raw data to Psychological Signal (Tier 3)
     */
    async enqueueActiveEnrichment(userId: string, entryId: string, sessionId: string): Promise<void> {
        try {
            const queue = queueService.registerQueue(ENRICHMENT_QUEUE_NAME);

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

    /**
     * Passive enrichment – pending refinement for behavioral syncs.
     */
    async enqueuePassiveEnrichment(userId: string, sessionId: string): Promise<void> {
        logger.debug(`Enrichment Service: Passive enrichment triggered for session ${sessionId} - Feature pending.`);
    }
}

export const enrichmentService = new EnrichmentService();
export default enrichmentService;
