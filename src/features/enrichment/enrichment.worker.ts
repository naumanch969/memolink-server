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
import { WebActivity } from '../web-activity/web-activity.model';
import { calculateSessionSignificance } from './enrichment.constants';
import { ENRICHMENT_QUEUE_NAME, initEnrichmentQueue } from './enrichment.queue';
import { EnrichmentJobData, EnrichmentStrategyInput, EnrichmentStrategyOutput, IEnrichmentStrategy, SourceType } from './enrichment.types';
import { activeInterpreter } from './interpreters/active.interpreter';
import { passiveInterpreter } from './interpreters/passive.interpreter';
import { EnrichedEntry } from './models/enriched-entry.model';

/**
 * Strategies for different enrichment types
 */
class ActiveStrategy implements IEnrichmentStrategy {
    async execute({ userId, referenceId }: EnrichmentStrategyInput): Promise<EnrichmentStrategyOutput> {
        if (!referenceId) throw new Error('Active enrichment requires referenceId');

        const entry = await Entry.findByIdAndUpdate(referenceId, {
            status: 'processing',
            'metadata.processingStep': 'analyzing_intent'
        }, { new: true });

        if (!entry) throw new Error(`Entry ${referenceId} not found`);
        socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
            _id: referenceId,
            status: 'processing',
            metadata: { processingStep: 'analyzing_intent' }
        });

        const result = await activeInterpreter.process(entry.content);

        return {
            result,
            contentForEmbedding: entry.content,
            timestamp: entry.date || entry.createdAt || new Date(),
            inputMethod: (entry as any).inputMethod || (entry.type === 'mixed' ? 'voice' : 'text'),
            analyticsData: {
                totalDuration: entry.metadata?.duration || 0,
                significanceScore: 100
            },
            extractionFlags: []
        };
    }
}

class PassiveStrategy implements IEnrichmentStrategy {
    async execute({ userId, sessionId }: EnrichmentStrategyInput): Promise<EnrichmentStrategyOutput> {
        // Final guard to prevent duplicate AI work
        const alreadyDone = await EnrichedEntry.exists({ userId, sessionId, sourceType: 'passive' });
        if (alreadyDone) throw new Error('Passive enrichment already completed for this session');

        const stats = await WebActivity.findOne({ userId, date: sessionId });
        if (!stats) throw new Error(`Stats for ${sessionId} not found`);

        const domainEntries = stats.domainMap instanceof Map ? stats.domainMap.entries() : Object.entries(stats.domainMap || {});
        const domainSummary = Array.from(domainEntries)
            .map(([domain, seconds]) => {
                const cleanDomain = domain.replace(/__dot__/g, '.');
                return `${cleanDomain}: ${Math.round(Number(seconds) / 60)}m`;
            })
            .join(', ');

        const behavioralLog = `Duration: ${Math.round(stats.totalSeconds / 60)}m. Activity: ${domainSummary}`;
        const result = await passiveInterpreter.process(behavioralLog);
        const { score, minActive } = calculateSessionSignificance(stats.totalSeconds);

        return {
            result,
            contentForEmbedding: behavioralLog,
            timestamp: new Date(stats.date),
            inputMethod: 'system',
            analyticsData: {
                totalDuration: minActive,
                significanceScore: score
            },
            extractionFlags: ['passive_inference']
        };
    }
}

const strategies: Record<SourceType, IEnrichmentStrategy> = {
    active: new ActiveStrategy(),
    passive: new PassiveStrategy()
};

const processJob = async (job: Job<EnrichmentJobData>) => {
    const { userId, sourceType, referenceId, sessionId } = job.data;

    try {
        const strategy = strategies[sourceType];
        if (!strategy) {
            logger.warn(`No strategy found for source type: ${sourceType}`);
            return;
        }

        const {
            result,
            contentForEmbedding,
            analyticsData,
            extractionFlags,
            timestamp,
            inputMethod
        } = await strategy.execute({ userId, sessionId, referenceId });

        // Phase: Indexing
        if (referenceId) {
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: referenceId,
                metadata: { processingStep: 'indexing' }
            });
        }
        const embedding = await LLMService.generateEmbeddings(contentForEmbedding);

        // Phase: Entity Resolution
        let resolvedEntities: any[] = [];
        if (sourceType === 'active') {
            if (referenceId) {
                socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                    _id: referenceId,
                    metadata: { processingStep: 'resolving_entities' }
                });
            }

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

        // Phase: Storage
        if (referenceId) {
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: referenceId,
                metadata: { processingStep: 'storing_memory' }
            });
        }

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
        } else if (sourceType === 'passive') {
            // Find just the enriched data piece we need for the UI
            const summary = await EnrichedEntry.findOne({ userId, sessionId, sourceType }).lean();
            socketService.emitToUser(userId, SocketEvents.PASSIVE_SUMMARY_UPDATED, summary);
        }

        logger.info(`Enrichment complete for ${sourceType} session ${sessionId}`);
    } catch (error: any) {
        logger.error(`Enrichment job ${job.id} failed`, error);

        // Handle failure...
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
