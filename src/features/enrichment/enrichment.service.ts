import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import DateUtil from '../../shared/utils/date.utils';
import { WebActivity } from '../web-activity/web-activity.model';
import { calculateSessionSignificance, SIGNIFICANCE_GATE_SCORE } from './enrichment.constants';
import { IEnrichmentService } from './enrichment.interfaces';
import { getEnrichmentQueue } from './enrichment.queue';
import { EnrichedEntry } from './models/enriched-entry.model';

export class EnrichmentService implements IEnrichmentService {
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

    /**
     * Evaluates if a daily web session (WebActivity) is significant enough to trigger passive enrichment.
     * Replaces trackSessionActivity (UsageStats-based gate).
     */
    async evaluatePassiveGate(userId: string, date: string): Promise<void> {
        const sessionId = DateUtil.getSessionId(new Date(date));

        try {
            // 1. Fetch current daily activity (the source of truth)
            const stats = await WebActivity.findOne({ userId: new Types.ObjectId(userId), date });
            if (!stats) return;

            // 2. Calculate Significance Score (Gate Formula)
            const { score } = calculateSessionSignificance(stats.totalSeconds);

            // 3. Trigger Enrichment if score crosses the gate (>= 40)
            if (score >= SIGNIFICANCE_GATE_SCORE) {
                const alreadyEnriched = await EnrichedEntry.exists({ userId, sessionId, sourceType: 'passive' });
                if (!alreadyEnriched) {
                    await this.enqueuePassiveEnrichment(userId, sessionId);
                }
            }
        } catch (error) {
            logger.error(`Enrichment Service: Failed to evaluate passive gate for ${userId} (${date})`, error);
        }
    }

    async enqueuePassiveEnrichment(userId: string, sessionId: string): Promise<void> {
        try {
            const queue = getEnrichmentQueue();
            await queue.add('process-passive', {
                userId,
                sourceType: 'passive',
                sessionId
            });
            logger.info(`Enrichment Service: Enqueued passive enrichment for session ${sessionId}`);
        } catch (error) {
            logger.error(`Enrichment Service: Failed to enqueue passive enrichment for ${sessionId}`, error);
        }
    }
}

export const enrichmentService: IEnrichmentService = new EnrichmentService();
export default enrichmentService;
