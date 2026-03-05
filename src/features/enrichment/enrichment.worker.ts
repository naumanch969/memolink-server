import { Job, Worker } from 'bullmq';
import { logger } from '../../config/logger';
import { redisConnection } from '../../config/redis';
import { LLMService } from '../../core/llm/llm.service';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import { Entry } from '../entry/entry.model';
import { ENRICHMENT_QUEUE_NAME, EnrichmentJobData } from './enrichment.service';
import { activeInterpreter } from './interpreters/active.interpreter';
import { EnrichedEntry } from './models/enriched-entry.model';

/**
 * EnrichmentWorker: The AI Backend Refinery
 */
export class EnrichmentWorker {
    private worker: Worker | null = null;

    public init() {
        if (this.worker) return;

        this.worker = new Worker(ENRICHMENT_QUEUE_NAME, this.processJob.bind(this), {
            connection: redisConnection as any,
            concurrency: 2,
            removeOnComplete: { count: 100 }
        });

        logger.info('Enrichment Worker Online');
    }

    private async processJob(job: Job<EnrichmentJobData>) {
        const { userId, sourceType, referenceId } = job.data;

        try {
            if (sourceType !== 'active' || !referenceId) return;

            const entry = await Entry.findById(referenceId);
            if (!entry) return;

            // 1. Generate Narrative & Psychological Metadata
            const result = await activeInterpreter.process(entry.content);
            const embedding = await LLMService.generateEmbeddings(result.content);

            // 2. Persist Tier 3 Uplift
            await EnrichedEntry.findOneAndUpdate(
                { referenceId },
                {
                    $set: {
                        userId,
                        sessionId: job.data.sessionId,
                        sourceType,
                        inputMethod: entry.type === 'mixed' ? 'voice' : 'text',
                        processingStatus: 'completed',
                        content: result.content,
                        metadata: result.metadata,
                        extraction: {
                            ...result.extraction,
                            modelVersion: 'gemini-1.5-flash'
                        },
                        embedding,
                        timestamp: new Date()
                    }
                },
                { upsert: true }
            );

            // Notify UI that the "Psychological Signal" is ready
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: referenceId,
                aiProcessed: true
            });

            logger.info(`Enrichment complete for ${referenceId}`);
        } catch (error) {
            logger.error(`Enrichment job ${job.id} failed`, error);
            throw error;
        }
    }
}

export const enrichmentWorker = new EnrichmentWorker();
export default enrichmentWorker;
