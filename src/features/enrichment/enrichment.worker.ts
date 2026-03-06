import { Job } from 'bullmq';
import { logger } from '../../config/logger';
import { LLMService } from '../../core/llm/llm.service';
import { queueService } from '../../core/queue/queue.service';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import { AGENT_CONSTANTS } from '../agent/agent.constants';
import entityService from '../entity/entity.service';
import { Entry } from '../entry/entry.model';
import entryService from '../entry/entry.service';
import { NodeType } from '../graph/edge.model';
import { ENRICHMENT_QUEUE_NAME, initEnrichmentQueue } from './enrichment.queue';
import { EnrichmentJobData } from './enrichment.types';
import { activeInterpreter } from './interpreters/active.interpreter';
import { passiveInterpreter } from './interpreters/passive.interpreter';
import { EnrichedEntry } from './models/enriched-entry.model';
import { UsageStats } from './models/usage-stats.model';

const processJob = async (job: Job<EnrichmentJobData>) => {
    const { userId, sourceType, referenceId, sessionId } = job.data;

    try {
        let contentForEmbedding = '';
        let result: any;
        let extractionFlags: string[] = [];
        let analyticsData: any = {};
        let timestamp = new Date();
        let inputMethod: any = 'system';

        if (sourceType === 'active' && referenceId) {
            const entry = await Entry.findById(referenceId);
            if (!entry) return;

            // Signal UI: processing started
            await Entry.findByIdAndUpdate(referenceId, {
                status: 'processing',
                'metadata.processingStep': 'analyzing_intent'
            });
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: referenceId,
                status: 'processing',
                metadata: { processingStep: 'analyzing_intent' }
            });

            result = await activeInterpreter.process(entry.content);
            contentForEmbedding = entry.content;
            timestamp = entry.date || entry.createdAt || new Date();
            inputMethod = (entry as any).inputMethod || (entry.type === 'mixed' ? 'voice' : 'text');
            analyticsData = {
                totalDuration: entry.metadata?.duration || 0,
                significanceScore: 100
            };
        } else if (sourceType === 'passive' && sessionId) {
            const stats = await UsageStats.findOne({ userId, sessionId });
            if (!stats) return;

            // Construct behavioral summary for the LLM
            const domainSummary = Array.from((stats as any).domainMap?.entries() || [])
                .map(([domain, seconds]) => `${domain}: ${Math.round(Number(seconds) / 60)}m`)
                .join(', ');

            const appSummary = (stats.appStats || [])
                .map(app => `${app.appName}: ${Math.round(app.duration / 60)}m`)
                .join(', ');

            const behavioralLog = `Duration: ${Math.round(stats.totalSeconds / 60)}m. Activity: ${domainSummary}${appSummary ? ' | Apps: ' + appSummary : ''}`;

            result = await passiveInterpreter.process(behavioralLog);
            contentForEmbedding = behavioralLog;
            timestamp = stats.lastUpdated || new Date();
            inputMethod = 'system';

            const minActive = Math.round(stats.totalSeconds / 60);
            const interactionFactor = (stats.totalSeconds > 0 ? 10 : 0); // Proxy
            analyticsData = {
                totalDuration: minActive,
                topApp: stats.appStats?.[0]?.appName || null,
                significanceScore: Math.round((minActive / 240 * 60) + (interactionFactor / 50 * 40))
            };
            extractionFlags = ['passive_inference'];
        } else {
            return;
        }

        socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
            _id: referenceId,
            metadata: { processingStep: 'indexing' }
        });

        // Use RAW content for embeddings
        const embedding = await LLMService.generateEmbeddings(contentForEmbedding);

        socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
            _id: referenceId,
            metadata: { processingStep: 'resolving_entities' }
        });

        // 2. Resolve Entities (Find or Create) - Only for Active for now
        let resolvedEntities: any[] = [];
        if (sourceType === 'active') {
            resolvedEntities = await Promise.all(
                (result.metadata.entities || []).map(async (ent: any) => {
                    try {
                        let otype = NodeType.ENTITY;
                        if (ent.type === 'person') otype = NodeType.PERSON;
                        else if (ent.type === 'organization') otype = NodeType.ORGANIZATION;
                        else if (ent.type === 'project') otype = NodeType.PROJECT;

                        const entity = await entityService.findOrCreateEntity(userId, ent.name, otype as any);
                        return {
                            entityId: entity._id,
                            name: ent.name,
                            type: ent.type,
                            confidence: ent.confidence,
                            source: 'extracted' as const
                        };
                    } catch (err) {
                        return { name: ent.name, type: ent.type, confidence: ent.confidence, source: 'extracted' as const };
                    }
                })
            );
        }

        socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
            _id: referenceId,
            metadata: { processingStep: 'storing_memory' }
        });

        // 3. Persist EnrichedEntry (upsert)
        await EnrichedEntry.findOneAndUpdate(
            { userId, sessionId, sourceType },
            {
                $set: {
                    userId,
                    sessionId,
                    referenceId,
                    sourceType,
                    inputMethod,
                    processingStatus: 'completed',
                    metadata: {
                        ...result.metadata,
                        entities: resolvedEntities
                    },
                    narrative: result.narrative,
                    extraction: {
                        ...result.extraction,
                        flags: [...result.extraction.flags, ...extractionFlags],
                        modelVersion: AGENT_CONSTANTS.DEFAULT_TEXT_MODEL
                    },
                    analytics: analyticsData,
                    embedding,
                    timestamp
                }
            },
            { upsert: true }
        );

        if (sourceType === 'active' && referenceId) {
            await Entry.findByIdAndUpdate(referenceId, { status: 'completed' });
            const fullEntry = await entryService.getEntryById(referenceId, userId);
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, fullEntry);
        }

        logger.info(`Enrichment complete for ${sourceType} session ${sessionId}`);
    } catch (error: any) {
        logger.error(`Enrichment job ${job.id} failed`, error);

        const isQuotaError = error.status === 429 || error.message?.includes('429') || error.message?.includes('quota');
        const errorMessage = isQuotaError ? 'Daily AI quota exceeded. Please try again later.' : (error.message || 'Internal processing error');

        if (referenceId) {
            await Entry.findByIdAndUpdate(referenceId, {
                status: 'failed',
                'metadata.error': errorMessage
            }).catch(() => { });

            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: referenceId,
                status: 'failed',
                metadata: { error: errorMessage }
            });
        }
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
