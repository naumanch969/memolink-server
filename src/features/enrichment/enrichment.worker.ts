import { Job } from 'bullmq';
import { logger } from '../../config/logger';
import { LLMService } from '../../core/llm/llm.service';
import { queueService } from '../../core/queue/queue.service';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import { AGENT_CONSTANTS } from '../agent/agent.constants';
import { Entry } from '../entry/entry.model';
import entryService from '../entry/entry.service';
import { ENRICHMENT_QUEUE_NAME, initEnrichmentQueue } from './enrichment.queue';
import { EnrichmentJobData } from './enrichment.types';
import { activeInterpreter } from './interpreters/active.interpreter';
import { EnrichedEntry } from './models/enriched-entry.model';

const processJob = async (job: Job<EnrichmentJobData>) => {
    const { userId, sourceType, referenceId } = job.data;

    if (sourceType !== 'active' || !referenceId) return;

    const entry = await Entry.findById(referenceId);
    if (!entry) return;

    // 0. Signal UI: processing started
    await Entry.findByIdAndUpdate(referenceId, {
        status: 'processing',
        'metadata.processingStep': 'analyzing_intent'
    });
    socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
        _id: referenceId,
        status: 'processing',
        metadata: { processingStep: 'analyzing_intent' }
    });

    try {
        // 1. Generate Narrative & Psychological Metadata via LLM
        const result = await activeInterpreter.process(entry.content);

        socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
            _id: referenceId,
            metadata: { processingStep: 'indexing' }
        });

        const embedding = await LLMService.generateEmbeddings(result.content);

        socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
            _id: referenceId,
            metadata: { processingStep: 'storing_memory' }
        });

        // 2. Persist EnrichedEntry (upsert — safe to re-run)
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
                        modelVersion: AGENT_CONSTANTS.DEFAULT_TEXT_MODEL
                    },
                    embedding,
                    timestamp: new Date()
                }
            },
            { upsert: true }
        );

        // 3. Mark Entry completed and push full merged entry to client
        await Entry.findByIdAndUpdate(referenceId, { status: 'completed' });
        const fullEntry = await entryService.getEntryById(referenceId, userId);
        socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, fullEntry);

        logger.info(`Enrichment complete for ${referenceId}`);
    } catch (error) {
        logger.error(`Enrichment job ${job.id} failed`, error);
        await Entry.findByIdAndUpdate(referenceId, { status: 'failed' }).catch(() => { });
        socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, { _id: referenceId, status: 'failed' });
        throw error;
    }
};

export const initEnrichmentWorker = () => {
    initEnrichmentQueue();

    const worker = queueService.registerWorker<EnrichmentJobData>(
        ENRICHMENT_QUEUE_NAME,
        processJob,
        {
            concurrency: 1,
            lockDuration: 300000,
            limiter: {
                max: 10,
                duration: 60000
            }
        }
    );

    worker.on('failed', (job, err) => {
        logger.error(`Enrichment job ${job?.id} failed permanently`, err);
    });

    logger.info('Enrichment Worker initialized');
    return worker;
};
 