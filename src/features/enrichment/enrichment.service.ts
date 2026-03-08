import { Types } from 'mongoose';
import logger from '../../config/logger';
import { LLMService } from '../../core/llm/llm.service';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import DateUtil from '../../shared/utils/date.utils';
import { AGENT_CONSTANTS } from '../agent/agent.constants';
import entityService from '../entity/entity.service';
import { Entry } from '../entry/entry.model';
import entryService from '../entry/entry.service';
import { NodeType } from '../graph/edge.model';
import { WebActivity } from '../web-activity/web-activity.model';
import { calculateSessionSignificance, HEALING_BATCH_SIZE, HEALING_STALENESS_THRESHOLD_MS, MAX_HEALING_ATTEMPTS, SIGNIFICANCE_GATE_SCORE } from './enrichment.constants';
import { IEnrichmentService } from './enrichment.interfaces';
import { getEnrichmentQueue } from './enrichment.queue';
import { ProcessingStep, SignalTier } from './enrichment.types';
import { activeInterpreter } from './interpreters/active.interpreter';
import { logInterpreter } from './interpreters/log.interpreter';
import { noiseInterpreter } from './interpreters/noise.interpreter';
import { passiveInterpreter } from './interpreters/passive.interpreter';
import { EnrichedEntry } from './models/enriched-entry.model';

export class EnrichmentService implements IEnrichmentService {
    async enqueueActiveEnrichment(userId: string, entryId: string, sessionId: string, signalTier: SignalTier): Promise<void> {
        try {
            const queue = getEnrichmentQueue();
            await queue.add('process-active', {
                userId,
                sourceType: 'active',
                sessionId,
                referenceId: entryId,
                signalTier: signalTier as any
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

    async processActiveEnrichment(userId: string, entryId: string, sessionId: string, signalTier?: SignalTier): Promise<void> {
        try {
            const entry = await Entry.findByIdAndUpdate(entryId, {
                status: 'processing',
                'metadata.processingStep': ProcessingStep.ANALYZING_INTENT,
                signalTier: signalTier as any
            }, { new: true });

            if (!entry) throw new Error(`Entry ${entryId} not found`);

            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: entryId,
                status: 'processing',
                metadata: { processingStep: ProcessingStep.ANALYZING_INTENT },
                signalTier: entry.signalTier
            });

            // ─── TIER 0: NOISE ──────────────────────────────────────────────────
            if (entry.signalTier === 'noise') {
                const { embedding } = await noiseInterpreter.process(entry.content);

                await EnrichedEntry.findOneAndUpdate(
                    { userId, sessionId, sourceType: 'active' },
                    {
                        $set: {
                            userId,
                            sessionId,
                            referenceId: entryId,
                            sourceType: 'active',
                            inputMethod: (entry as any).inputMethod || (entry.type === 'mixed' ? 'voice' : 'text'),
                            processingStatus: 'noise',
                            signalTier: 'noise',
                            metadata: {
                                themes: [],
                                emotions: [],
                                entities: [],
                                sentimentScore: 0,
                                energyLevel: 'medium',
                                cognitiveLoad: 'focused'
                            },
                            narrative: {
                                signal: 'Noise entry (no enrichment)',
                                coreThought: 'Noise'
                            },
                            extraction: {
                                confidenceScore: 1,
                                modelVersion: 'none',
                                flags: ['noise']
                            },
                            analytics: {
                                totalDuration: 0,
                                significanceScore: 0
                            },
                            embedding,
                            timestamp: entry.date || entry.createdAt || new Date()
                        }
                    },
                    { upsert: true }
                );

                await Entry.findByIdAndUpdate(entryId, { status: 'completed' });
                const fullEntry = await entryService.getEntryById(entryId, userId);
                socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, fullEntry);
                logger.info(`Noise entry processed for ${entryId}`);
                return;
            }

            // ─── TIER 1: LOG ────────────────────────────────────────────────────
            let result;
            if (entry.signalTier === 'log') {
                result = await logInterpreter.process(entry.content);
            } else {
                // ─── TIER 2 & 3: SIGNAL / DEEP SIGNAL ─────────────────────────────
                result = await activeInterpreter.process(entry.content);
                if (entry.signalTier === 'deep_signal') {
                    result.extraction.flags.push('deep_signal');
                }
            }

            // Phase: Indexing
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: entryId,
                metadata: { processingStep: ProcessingStep.INDEXING }
            });
            const embedding = await LLMService.generateEmbeddings(entry.content);

            // Phase: Entity Resolution
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: entryId,
                metadata: { processingStep: ProcessingStep.RESOLVING_ENTITIES }
            });

            const resolvedEntities = await Promise.all(
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

            // Phase: Storage
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: entryId,
                metadata: { processingStep: ProcessingStep.STORING_MEMORY }
            });

            await EnrichedEntry.findOneAndUpdate(
                { userId, sessionId, sourceType: 'active' },
                {
                    $set: {
                        userId,
                        sessionId,
                        referenceId: entryId,
                        sourceType: 'active',
                        signalTier: entry.signalTier,
                        inputMethod: (entry as any).inputMethod || (entry.type === 'mixed' ? 'voice' : 'text'),
                        processingStatus: 'completed',
                        metadata: {
                            ...result.metadata,
                            entities: resolvedEntities
                        },
                        narrative: result.narrative,
                        extraction: {
                            ...result.extraction,
                            modelVersion: AGENT_CONSTANTS.DEFAULT_TEXT_MODEL
                        },
                        analytics: {
                            totalDuration: entry.metadata?.duration || 0,
                            significanceScore: 100
                        },
                        embedding,
                        timestamp: entry.date || entry.createdAt || new Date()
                    }
                },
                { upsert: true }
            );

            await Entry.findByIdAndUpdate(entryId, { status: 'completed' });
            const fullEntry = await entryService.getEntryById(entryId, userId);
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, fullEntry);

            logger.info(`Enrichment complete for active session ${sessionId} (Tier: ${entry.signalTier})`);
        } catch (error: any) {
            await this.handleEnrichmentFailure(userId, entryId, error);
            throw error;
        }
    }

    async processPassiveEnrichment(userId: string, sessionId: string): Promise<void> {
        try {
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

            const embedding = await LLMService.generateEmbeddings(behavioralLog);

            await EnrichedEntry.findOneAndUpdate(
                { userId, sessionId, sourceType: 'passive' },
                {
                    $set: {
                        userId,
                        sessionId,
                        sourceType: 'passive',
                        inputMethod: 'system',
                        processingStatus: 'completed',
                        metadata: result.metadata,
                        narrative: result.narrative,
                        extraction: {
                            ...result.extraction,
                            flags: [...result.extraction.flags, 'passive_inference'],
                            modelVersion: AGENT_CONSTANTS.DEFAULT_TEXT_MODEL
                        },
                        analytics: {
                            totalDuration: minActive,
                            significanceScore: score
                        },
                        embedding,
                        timestamp: new Date(stats.date)
                    }
                },
                { upsert: true }
            );

            const summary = await EnrichedEntry.findOne({ userId, sessionId, sourceType: 'passive' }).lean();
            socketService.emitToUser(userId, SocketEvents.PASSIVE_SUMMARY_UPDATED, summary);

            logger.info(`Enrichment complete for passive session ${sessionId}`);
        } catch (error: any) {
            logger.error(`Passive enrichment failed for ${sessionId}`, error);
            throw error;
        }
    }

    async runEnrichmentHealingBatch(limit: number = HEALING_BATCH_SIZE): Promise<void> {
        const oneHourAgo = new Date(Date.now() - HEALING_STALENESS_THRESHOLD_MS);

        try {
            // Find entries with incomplete or failed enrichment
            const candidates = await EnrichedEntry.find({
                signalTier: { $nin: ['noise', 'log'] }, // Skip noise/log tiers as they don't have full narratives
                $or: [
                    { processingStatus: { $in: ['failed', 'pending'] } },
                    { 'narrative.coreThought': { $in: [null, ''] } },
                    { 'narrative.signal': { $in: [null, ''] } },
                    { 'metadata.themes': { $size: 0 } }
                ],
                healingAttempts: { $lt: MAX_HEALING_ATTEMPTS },
                createdAt: { $lt: oneHourAgo }
            })
                .sort({ createdAt: -1 })
                .limit(limit);

            if (candidates.length === 0) {
                return;
            }

            logger.info(`Enrichment Healing: Found ${candidates.length} candidates for re-enrichment`);

            for (const enrichedEntry of candidates) {
                try {
                    // Increment healing attempt count
                    enrichedEntry.healingAttempts += 1;
                    await enrichedEntry.save();

                    // Active enrichment requires the original entry
                    if (enrichedEntry.sourceType === 'active' && enrichedEntry.referenceId) {
                        logger.info(`Enrichment Healing: Re-processing active entry ${enrichedEntry.referenceId}`);
                        await this.processActiveEnrichment(
                            enrichedEntry.userId.toString(),
                            enrichedEntry.referenceId.toString(),
                            enrichedEntry.sessionId,
                            enrichedEntry.signalTier
                        );
                    } else if (enrichedEntry.sourceType === 'passive') {
                        logger.info(`Enrichment Healing: Re-processing passive session ${enrichedEntry.sessionId}`);
                        await this.processPassiveEnrichment(
                            enrichedEntry.userId.toString(),
                            enrichedEntry.sessionId
                        );
                    }

                    // Prevent API rate limiting (Gemini) by adding a small gap between processing
                    await new Promise(resolve => setTimeout(resolve, 3000));
                } catch (err: any) {
                    logger.error(`Enrichment Healing: Failed to heal ${enrichedEntry._id}`, err);
                    // We don't throw here to allow the loop to continue with other candidates
                }
            }

            logger.info('Enrichment Healing: Batch completed');
        } catch (error) {
            logger.error('Enrichment Healing: Batch failed', error);
        }
    }

    private async handleEnrichmentFailure(userId: string, entryId: string | undefined, error: any): Promise<void> {
        logger.error(`Enrichment failed`, error);
        if (!entryId) return;

        const isQuotaError = error.status === 429 || error.message?.includes('429') || error.message?.includes('quota');
        const errorMessage = isQuotaError ? 'Daily AI quota exceeded. Please try again later.' : (error.message || 'Internal processing error');

        await Entry.findByIdAndUpdate(entryId, {
            status: 'failed',
            'metadata.error': errorMessage
        }).catch(() => { });

        socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
            _id: entryId,
            status: 'failed',
            metadata: { error: errorMessage }
        });
    }
}

export const enrichmentService: IEnrichmentService = new EnrichmentService();
export default enrichmentService;
