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
import { PassiveSession } from '../web-activity/passive-session.model';
import { WebActivity } from '../web-activity/web-activity.model';
import { calculateSessionSignificance, HEALING_BATCH_SIZE, HEALING_STALENESS_THRESHOLD_MS, MAX_HEALING_ATTEMPTS, SIGNIFICANCE_GATE_SCORE } from './enrichment.constants';
import { IEnrichmentService } from './enrichment.interfaces';
import { ENRICHMENT_JOB_ACTIVE, ENRICHMENT_JOB_PASSIVE } from '../../core/queue/queue.constants';
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
            await queue.add(ENRICHMENT_JOB_ACTIVE, {
                userId,
                sourceType: 'active',
                sessionId,
                referenceId: entryId,
                signalTier: signalTier as any,
            });
            logger.info(`Enrichment Service: Enqueued task for entry ${entryId}`);
        } catch (error) {
            logger.error(`Enrichment Service: Failed to enqueue for ${entryId}`, error);
            // FIX: mark entry so the healing batch can pick it up
            await Entry.findByIdAndUpdate(entryId, { 'metadata.enrichmentPending': true }).catch(() => { });
        }
    }

    /**
     * Evaluates if a daily web session (WebActivity) is significant enough to trigger passive enrichment.
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
                await this.enqueuePassiveEnrichment(userId, sessionId);
            }
        } catch (error) {
            logger.error(`Enrichment Service: Failed to evaluate passive gate for ${userId} (${date})`, error);
        }
    }

    async enqueuePassiveEnrichment(userId: string, sessionId: string): Promise<void> {
        try {
            const queue = getEnrichmentQueue();
            // FIX: jobId deduplicates — BullMQ silently ignores duplicate waiting/active jobs
            await queue.add(ENRICHMENT_JOB_PASSIVE, {
                userId,
                sourceType: 'passive',
                sessionId,
            }, {
                jobId: `passive:${userId}:${sessionId}`,
            });
            logger.info(`Enrichment Service: Enqueued passive enrichment for session ${sessionId}`);
        } catch (error) {
            logger.error(`Enrichment Service: Failed to enqueue passive enrichment for ${sessionId}`, error);
        }
    }

    async processActiveEnrichment(userId: string, entryId: string, sessionId: string, signalTier?: SignalTier): Promise<void> {
        try {
            // FIX: idempotency guard — skip if already fully enriched (safe on BullMQ retries)
            const alreadyCompleted = await EnrichedEntry.exists({ referenceId: new Types.ObjectId(entryId), processingStatus: 'completed', });
            if (alreadyCompleted) {
                logger.info(`Enrichment Service: Skipping already-completed active enrichment for ${entryId}`);
                return;
            }

            const entry = await Entry.findByIdAndUpdate(entryId, {
                status: 'processing',
                'metadata.processingStep': ProcessingStep.ANALYZING_INTENT,
                signalTier: signalTier as any,
            }, { new: true });

            if (!entry) throw new Error(`Entry ${entryId} not found`);

            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: entryId,
                status: 'processing',
                metadata: { processingStep: ProcessingStep.ANALYZING_INTENT },
                signalTier: entry.signalTier,
            });

            // ─── TIER 0: NOISE ────────────────────────────────────────────────────
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
                                cognitiveLoad: 'focused',
                            },
                            narrative: {
                                signal: 'Noise entry (no enrichment)',
                                coreThought: 'Noise',
                            },
                            extraction: {
                                confidenceScore: 1,
                                modelVersion: 'none',
                                flags: ['noise'],
                            },
                            analytics: {
                                totalDuration: 0,
                                significanceScore: 0,
                            },
                            embedding,
                            timestamp: entry.date || entry.createdAt || new Date(),
                        },
                    },
                    { upsert: true }
                );

                // FIX: use { new: true } to avoid extra DB read
                const completedEntry = await Entry.findByIdAndUpdate(entryId, { status: 'completed' }, { new: true, lean: true });
                socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, completedEntry);
                logger.info(`Noise entry processed for ${entryId}`);
                return;
            }

            // ─── TIER 1: LOG / TIER 2+3: SIGNAL / DEEP SIGNAL ───────────────────
            // FIX: run interpreter + embeddings in parallel (was serial — wasted 1-2s)
            let interpreterPromise: Promise<any>;
            if (entry.signalTier === 'log') {
                interpreterPromise = logInterpreter.process(entry.content);
            } else {
                interpreterPromise = activeInterpreter.process(entry.content);
            }

            // Phase: Indexing
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: entryId,
                metadata: { processingStep: ProcessingStep.INDEXING },
            });

            const [result, embedding] = await Promise.all([
                interpreterPromise,
                LLMService.generateEmbeddings(entry.content),
            ]);

            if (entry.signalTier === 'deep_signal') {
                result.extraction.flags.push('deep_signal');
            }

            // Phase: Entity Resolution
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: entryId,
                metadata: { processingStep: ProcessingStep.RESOLVING_ENTITIES },
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
                            source: 'extracted' as const,
                        };
                    } catch {
                        return { name: ent.name, type: ent.type, confidence: ent.confidence, source: 'extracted' as const };
                    }
                })
            );

            // Phase: Storage
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: entryId,
                metadata: { processingStep: ProcessingStep.STORING_MEMORY },
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
                            entities: resolvedEntities,
                        },
                        narrative: result.narrative,
                        extraction: {
                            ...result.extraction,
                            modelVersion: AGENT_CONSTANTS.DEFAULT_TEXT_MODEL,
                        },
                        analytics: {
                            totalDuration: entry.metadata?.duration || 0,
                            significanceScore: 100,
                        },
                        embedding,
                        timestamp: entry.date || entry.createdAt || new Date(),
                    },
                },
                { upsert: true }
            );

            // FIX: use { new: true } to skip the extra entryService.getEntryById() round-trip
            const completedEntry = await Entry.findByIdAndUpdate(entryId, { status: 'completed' }, { new: true, lean: true });
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, completedEntry);

            logger.info(`Enrichment complete for active session ${sessionId} (Tier: ${entry.signalTier})`);
        } catch (error: any) {
            await this.handleEnrichmentFailure(userId, entryId, error);
            throw error;
        }
    }

    async processPassiveEnrichment(userId: string, sessionId: string): Promise<void> {
        try {
            const alreadyDone = await EnrichedEntry.exists({ userId, sessionId, sourceType: 'passive' });
            if (alreadyDone) {
                logger.info(`Enrichment already completed for passive session ${sessionId}, skipping.`);
                return;
            }

            const session = await PassiveSession.findById(sessionId);
            if (!session) throw new Error(`Passive session ${sessionId} not found`);

            const durationMins = Math.round(session.metrics.totalActiveTime / 60);

            // Reconstruct timeline representation from chronological logs
            const timeline = session.rawLogs
                .map((log: any) => `${log.domain} (${Math.round(log.duration / 60)}m)`)
                .join(' -> ');

            const behavioralLog = `Duration: ${durationMins}m. Category: ${session.primaryCategory}. Flow State Max: ${Math.round(session.metrics.flowDuration / 60)}m. Timeline: ${timeline}`;

            // FIX: run interpreter + embeddings in parallel
            const [result, embedding] = await Promise.all([
                passiveInterpreter.process(behavioralLog),
                LLMService.generateEmbeddings(behavioralLog),
            ]);

            const score = session.signalTier === 'deep_signal' ? 85 : session.signalTier === 'signal' ? 65 : 40;

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
                            modelVersion: AGENT_CONSTANTS.DEFAULT_TEXT_MODEL,
                        },
                        analytics: {
                            totalDuration: session.metrics.totalActiveTime,
                            significanceScore: score,
                        },
                        embedding,
                        timestamp: new Date(session.startTime),
                    },
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
                    { 'metadata.themes': { $size: 0 } },
                ],
                healingAttempts: { $lt: MAX_HEALING_ATTEMPTS },
                createdAt: { $lt: oneHourAgo },
            })
                .sort({ createdAt: -1 })
                .limit(limit);

            if (candidates.length === 0) return;

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
        const errorMessage = isQuotaError
            ? 'Daily AI quota exceeded. Please try again later.'
            : (error.message || 'Internal processing error');

        await Entry.findByIdAndUpdate(entryId, {
            status: 'failed',
            'metadata.error': errorMessage,
        }).catch(() => { });

        socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
            _id: entryId,
            status: 'failed',
            metadata: { error: errorMessage },
        });
    }
}

export const enrichmentService: IEnrichmentService = new EnrichmentService();
export default enrichmentService;
