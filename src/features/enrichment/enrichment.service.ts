import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import DateUtil from '../../shared/utils/date.utils';
import { getEnrichmentQueue } from './enrichment.queue';
import { EnrichedEntry } from './models/enriched-entry.model';
import { UsageStats } from './models/usage-stats.model';

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

    async trackSessionActivity(userId: string, activity: {
        totalSeconds: number,
        productiveSeconds: number,
        distractingSeconds: number,
        domainMap?: Record<string, number>,
        interactions?: number
    }): Promise<void> {
        const date = new Date();
        const sessionId = DateUtil.getSessionId(date);
        const dateKey = DateUtil.formatDate(date);

        try {
            // Prepare domainMap increments
            const domainInc: Record<string, number> = {};
            if (activity.domainMap) {
                for (const [domain, seconds] of Object.entries(activity.domainMap)) {
                    // Replace dots for Mongoose Map compatibility
                    const safeKey = domain.replace(/\./g, '__dot__');
                    domainInc[`domainMap.${safeKey}`] = seconds;
                }
            }

            // 1. Atomic update of session-level aggregated activity
            const stats = await UsageStats.findOneAndUpdate(
                { userId: new Types.ObjectId(userId), sessionId },
                {
                    $inc: {
                        totalSeconds: activity.totalSeconds,
                        productiveSeconds: activity.productiveSeconds,
                        distractingSeconds: activity.distractingSeconds,
                        ...domainInc
                    },
                    $set: {
                        date: dateKey,
                        lastUpdated: new Date()
                    }
                },
                { upsert: true, new: true }
            );

            // 2. Calculate Significance Score (Gate Formula)
            // (minActive/240 * 60) + (interactionDensity/50 * 40)
            const minActive = Math.round(stats.totalSeconds / 60);

            // Interaction factor: use provided or proxy based on duration
            const interactionFactor = activity.interactions || (activity.totalSeconds > 0 ? 10 : 0);
            const score = Math.round((minActive / 240 * 60) + (interactionFactor / 50 * 40));

            // 3. Trigger Enrichment if score crosses the gate (>= 40)
            if (score >= 40) {
                const alreadyEnriched = await EnrichedEntry.exists({ userId, sessionId, sourceType: 'passive' });
                if (!alreadyEnriched) {
                    await this.enqueuePassiveEnrichment(userId, sessionId);
                }
            }
        } catch (error) {
            logger.error(`Enrichment Service: Failed to track session activity for ${userId}`, error);
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

export const enrichmentService = new EnrichmentService();
export default enrichmentService;
