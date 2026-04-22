import { Types } from 'mongoose';
import logger from '../../config/logger';
import { LLMService } from '../../core/llm/llm.service';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import DateUtil from '../../shared/utils/date.utils';
import { AGENT_CONSTANTS } from '../agent/agent.constants';
import entityService from '../entity/entity.service';
import tagService from '../tag/tag.service';
import { CognitiveLoad, EnergyLevel, EntitySource, EntityType, InputMethod, ProcessingStatus, ProcessingStep, SignalTier, SourceType } from './enrichment.types';
import { EntryType, EntryStatus } from '../entry/entry.types';
import { Entry } from '../entry/entry.model';
import { NodeType } from '../graph/edge.model';
import { PassiveSession } from '../web-activity/passive-session.model';
import { WebActivity } from '../web-activity/web-activity.model';
import { calculateSessionSignificance, HEALING_BATCH_SIZE, HEALING_STALENESS_THRESHOLD_MS, MAX_HEALING_ATTEMPTS, SIGNIFICANCE_GATE_SCORE } from './enrichment.constants';
import { IEnrichmentService } from './enrichment.interfaces';
import { ENRICHMENT_JOB_ACTIVE, ENRICHMENT_JOB_HEALING, ENRICHMENT_JOB_PASSIVE } from '../../core/queue/queue.constants';
import { getEnrichmentHealingQueue, getEnrichmentQueue } from './enrichment.queue';
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
                sourceType: SourceType.ACTIVE,
                sessionId,
                referenceId: entryId,
                signalTier: signalTier as any,
            });
            console.log('number of jobs: ', await queue.getJobCounts())
            // Set status to queued so UI can show it
            await Entry.findByIdAndUpdate(entryId, { status: EntryStatus.QUEUED }).catch(() => { });
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, { _id: entryId, status: EntryStatus.QUEUED });

            logger.info(`Enrichment Service: Enqueued task for entry ${entryId}`);
        } catch (error) {
            logger.error(`Enrichment Service: Failed to enqueue for ${entryId}`, error);
            // FIX: mark entry so the healing batch can pick it up
            await Entry.findByIdAndUpdate(entryId, { 'metadata.enrichmentPending': true }).catch(() => { });
        }
    }

    async enqueueHealingEnrichment(userId: string, entryId: string, sessionId: string, signalTier: SignalTier): Promise<void> {
        try {
            const queue = getEnrichmentHealingQueue();
            await queue.add(ENRICHMENT_JOB_HEALING, {
                userId,
                sourceType: SourceType.ACTIVE,
                sessionId,
                referenceId: entryId,
                signalTier: signalTier as any,
            }, {
                jobId: `healing:${entryId}`, // Deduplicate healing jobs for the same entry
            });

            logger.info(`Enrichment Service: Enqueued HEALING task for entry ${entryId}`);
        } catch (error) {
            logger.error(`Enrichment Service: Failed to enqueue healing for ${entryId}`, error);
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
                sourceType: SourceType.PASSIVE,
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
            const alreadyCompleted = await EnrichedEntry.exists({ referenceId: new Types.ObjectId(entryId), processingStatus: ProcessingStatus.COMPLETED, });
            if (alreadyCompleted) {
                logger.info(`Enrichment Service: Skipping already-completed active enrichment for ${entryId}`);
                return;
            }

            // Get Entry
            let entry = await Entry.findById(entryId);
            if (!entry) {
                logger.warn(`Enrichment Service: Entry ${entryId} not found immediately. Retrying in 500ms...`);
                await new Promise(resolve => setTimeout(resolve, 500));
                entry = await Entry.findById(entryId);
            }
            if (!entry) throw new Error(`Entry ${entryId} not found after retry. It might have been deleted or the ID is invalid.`);


            // Update Entry to processing status
            entry.status = EntryStatus.PROCESSING;
            entry.metadata = {
                ...entry.metadata,
                processingStep: ProcessingStep.ANALYZING_INTENT
            };
            if (signalTier) entry.signalTier = signalTier as any;
            await entry.save();

            // Let the UI know the entry is being processed
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: entryId,
                status: EntryStatus.PROCESSING,
                metadata: { processingStep: ProcessingStep.ANALYZING_INTENT },
                signalTier: entry.signalTier,
            });

            logger.info(`Enrichment Process [${entryId}]: Starting enrichment (Tier: ${entry.signalTier})`);

            // ─── TIER 0: NOISE ────────────────────────────────────────────────────
            if (entry.signalTier === SignalTier.NOISE) {
                const { embedding } = await noiseInterpreter.process(entry.content);

                await EnrichedEntry.findOneAndUpdate(
                    { userId, sessionId, sourceType: SourceType.ACTIVE },
                    {
                        $set: {
                            userId,
                            sessionId,
                            referenceId: entryId,
                            sourceType: SourceType.ACTIVE,
                            inputMethod: (entry as any).inputMethod || (entry.type === EntryType.MIXED ? InputMethod.VOICE : InputMethod.TEXT),
                            processingStatus: ProcessingStatus.NOISE,
                            signalTier: SignalTier.NOISE,
                            metadata: {
                                themes: [],
                                emotions: [],
                                entities: [],
                                sentimentScore: 0,
                                energyLevel: EnergyLevel.MEDIUM,
                                cognitiveLoad: CognitiveLoad.FOCUSED,
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

                const completedEntry = await Entry.findByIdAndUpdate(entryId, { status: EntryStatus.COMPLETED }, { new: true, lean: true });
                socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, completedEntry);
                logger.info(`Noise entry processed for ${entryId}`);
                return;
            }

            // ─── TIER 1: LOG / TIER 2+3: SIGNAL / DEEP SIGNAL ───────────────────
            let interpreterPromise: Promise<any>;
            if (entry.signalTier === SignalTier.LOG) {
                logger.debug(`Enrichment Process [${entryId}]: Using log interpreter`);
                interpreterPromise = logInterpreter.process(entry.content);
            } else {
                logger.debug(`Enrichment Process [${entryId}]: Using active interpreter`);
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

            logger.info(`Enrichment Process [${entryId}]: Interpreter & Embeddings complete`);

            if (entry.signalTier === SignalTier.DEEP_SIGNAL) {
                result.extraction.flags.push(SignalTier.DEEP_SIGNAL);
            }

            // Phase: Entity Resolution
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: entryId,
                metadata: { processingStep: ProcessingStep.RESOLVING_ENTITIES },
            });

            logger.debug(`Enrichment Process [${entryId}]: Resolving ${result.metadata.entities?.length || 0} entities`);

            const resolvedEntities = await Promise.all(
                (result.metadata.entities || [])
                    .filter((ent: any) => ent.type === EntityType.PERSON)
                    .map(async (ent: any) => {
                        try {
                            let otype = NodeType.ENTITY;
                            if (ent.type === EntityType.PERSON) otype = NodeType.PERSON;
                            else if (ent.type === EntityType.ORGANIZATION) otype = NodeType.ORGANIZATION;
                            else if (ent.type === EntityType.PROJECT) otype = NodeType.PROJECT;

                            const entity = await entityService.findOrCreateEntity(userId, ent.name, otype as any);
                            return {
                                entityId: entity._id,
                                name: ent.name,
                                type: ent.type,
                                confidence: ent.confidence,
                                source: EntitySource.EXTRACTED,
                            };
                        } catch {
                            return { name: ent.name, type: ent.type, confidence: ent.confidence, source: EntitySource.EXTRACTED };
                        }
                    })
            );

            // Phase: Tagging (Absorbed from Agent Module)
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: entryId,
                metadata: { processingStep: ProcessingStep.TAGGING },
            });

            logger.debug(`Enrichment Process [${entryId}]: Applying ${result.metadata.themes?.length || 0} tags`);
            const themes = result.metadata.themes || [];
            const tags = await Promise.all(
                themes.map((theme: string) => tagService.findOrCreateTag(userId, theme))
            );
            const tagIds = tags.map(t => t._id);

            // Update Entry with tags
            entry.tags = tagIds as any;
            await entry.save();

            // Increment usage counts
            await tagService.incrementUsage(userId, tagIds.map(id => id.toString()));

            // Phase: Storage
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
                _id: entryId,
                metadata: { processingStep: ProcessingStep.STORING_MEMORY },
            });

            await EnrichedEntry.findOneAndUpdate(
                { userId, sessionId, sourceType: SourceType.ACTIVE },
                {
                    $set: {
                        userId,
                        sessionId,
                        referenceId: entryId,
                        sourceType: SourceType.ACTIVE,
                        signalTier: entry.signalTier,
                        inputMethod: (entry as any).inputMethod || (entry.type === EntryType.MIXED ? InputMethod.VOICE : InputMethod.TEXT),
                        processingStatus: ProcessingStatus.COMPLETED,
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
            const completedEntry = await Entry.findByIdAndUpdate(entryId, { status: EntryStatus.COMPLETED }, { new: true, lean: true });
            socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, completedEntry);

            logger.info(`Enrichment Process [${entryId}]: Enrichment fully complete for session ${sessionId}`);
        } catch (error: any) {
            await this.handleEnrichmentFailure(userId, entryId, error);
            throw error;
        }
    }

    async processPassiveEnrichment(userId: string, sessionId: string): Promise<void> {
        try {
            const alreadyDone = await EnrichedEntry.exists({ userId, sessionId, sourceType: SourceType.PASSIVE });
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

            const score = session.signalTier === SignalTier.DEEP_SIGNAL ? 85 : session.signalTier === SignalTier.SIGNAL ? 65 : 40;

            await EnrichedEntry.findOneAndUpdate(
                { userId, sessionId, sourceType: SourceType.PASSIVE },
                {
                    $set: {
                        userId,
                        sessionId,
                        sourceType: SourceType.PASSIVE,
                        inputMethod: InputMethod.SYSTEM,
                        processingStatus: ProcessingStatus.COMPLETED,
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

            const summary = await EnrichedEntry.findOne({ userId, sessionId, sourceType: SourceType.PASSIVE }).lean();
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
            // ─── PHASE 1: STUCK ENTRIES (Missing from EnrichedEntry) ───────
            const stuckEntries = await Entry.find({
                $or: [
                    { 'metadata.enrichmentPending': true },
                    { status: { $in: [EntryStatus.PROCESSING, EntryStatus.FAILED] } }
                ],
                updatedAt: { $lt: oneHourAgo } // Only heal after a period of inactivity
            }).limit(limit);

            if (stuckEntries.length > 0) {
                logger.info(`Enrichment Healing: Found ${stuckEntries.length} stuck entries to re-enqueue`);
                for (const entry of stuckEntries) {
                    await this.enqueueHealingEnrichment(
                        entry.userId.toString(),
                        entry._id.toString(),
                        entry.sessionId || '',
                        entry.signalTier || SignalTier.SIGNAL
                    );
                    // Clear the pending flag once re-enqueued
                    await Entry.findByIdAndUpdate(entry._id, { $unset: { 'metadata.enrichmentPending': "" } });
                }
            }

            // ─── PHASE 2: INCOMPLETE ENRICHED ENTRIES ───────────────────
            const candidates = await EnrichedEntry.find({
                signalTier: { $nin: [SignalTier.NOISE, SignalTier.LOG] },
                $or: [
                    { processingStatus: { $in: [ProcessingStatus.FAILED, ProcessingStatus.PENDING] } },
                    { 'narrative.coreThought': { $in: [null, ''] } },
                    { 'narrative.signal': { $in: [null, ''] } },
                    { 'metadata.themes': { $size: 0 } },
                ],
                healingAttempts: { $lt: MAX_HEALING_ATTEMPTS },
                createdAt: { $lt: oneHourAgo },
            })
                .sort({ createdAt: -1 })
                .limit(limit);

            if (candidates.length === 0 && stuckEntries.length === 0) return;

            if (candidates.length > 0) {
                logger.info(`Enrichment Healing: Found ${candidates.length} candidates for re-enrichment`);

                for (const enrichedEntry of candidates) {
                    try {
                        enrichedEntry.healingAttempts += 1;
                        await enrichedEntry.save();

                        if (enrichedEntry.sourceType === SourceType.ACTIVE && enrichedEntry.referenceId) {
                            logger.info(`Enrichment Healing: Re-enqueuing active entry ${enrichedEntry.referenceId}`);
                            await this.enqueueHealingEnrichment(
                                enrichedEntry.userId.toString(),
                                enrichedEntry.referenceId.toString(),
                                enrichedEntry.sessionId,
                                enrichedEntry.signalTier
                            );
                        } else if (enrichedEntry.sourceType === SourceType.PASSIVE) {
                            logger.info(`Enrichment Healing: Re-enqueuing passive session ${enrichedEntry.sessionId}`);
                            await this.enqueuePassiveEnrichment(
                                enrichedEntry.userId.toString(),
                                enrichedEntry.sessionId
                            );
                        }
                    } catch (err: any) {
                        logger.error(`Enrichment Healing: Failed to heal enriched entry ${enrichedEntry._id}`, err);
                    }
                }
            }

            logger.info('Enrichment Healing: Completed all phases');
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
            status: EntryStatus.FAILED,
            'metadata.error': errorMessage,
        }).catch(() => { });

        socketService.emitToUser(userId, SocketEvents.ENTRY_UPDATED, {
            _id: entryId,
            status: EntryStatus.FAILED,
            metadata: { error: errorMessage },
        });
    }
    async cleanText(userId: string, text: string): Promise<string> {
        try {
            const prompt = `Clean raw/fragmented text into polished format while preserving meaning, tone, tags, and mentions. Dont add any extra text/information. \nInput: "${text}"\nCleaned Text:`;
            return (await LLMService.generateText(prompt, { workflow: 'text_cleaning', userId, temperature: 0.3 })).trim();
        } catch (error) {
            logger.error('Text cleaning failed', error);
            return text;
        }
    }
}

export const enrichmentService: IEnrichmentService = new EnrichmentService();
export default enrichmentService;
