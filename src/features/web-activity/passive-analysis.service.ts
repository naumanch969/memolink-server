import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { SignalTier, SourceType } from '../enrichment/enrichment.types';
import { ActivityDefinitions } from './activity-definitions.model';
import { PassiveSession } from './passive-session.model';
import { WebActivityEvent } from './web-activity.types';
import notificationService from '../notification/notification.service';
import { NotificationType } from '../notification/notification.types';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import { getEnrichmentQueue } from '../enrichment/enrichment.queue';

// Idle gap > 5 minutes splits a session
const SESSION_SPLIT_THRESHOLD_MS = 5 * 60 * 1000;

// Flow state requires uninterrupted time in non-distracting domains
const SUBSTANTIAL_FLOW_MINUTES = 30;

export class PassiveAnalysisService {
    /**
     * Process raw chronological events and extract them into Passive Sessions.
     * @param userId The ID of the user.
     * @param date The date string (YYYY-MM-DD).
     * @param events The array of raw chronological events from the active tab.
     */
    async processEvents(userId: string, date: string, events: WebActivityEvent[]): Promise<void> {
        if (!events || events.length === 0) return;

        // Ensure chronological order
        const sorted = [...events].sort((a, b) => a.startTime - b.startTime);

        // Fetch definitions to score domains
        const definitions = await ActivityDefinitions.findOne({ userId: new Types.ObjectId(userId) });
        const productiveDomains = new Set(definitions?.productiveDomains || []);
        const distractingDomains = new Set(definitions?.distractingDomains || []);

        const sessions: WebActivityEvent[][] = [];
        let currentSession: WebActivityEvent[] = [];

        // 1. Group into logical sessions separated by idle gaps
        for (let i = 0; i < sorted.length; i++) {
            const event = sorted[i];

            if (currentSession.length === 0) {
                currentSession.push(event);
            } else {
                const lastEvent = currentSession[currentSession.length - 1];
                const gapMs = event.startTime - lastEvent.endTime;

                if (gapMs > SESSION_SPLIT_THRESHOLD_MS) {
                    sessions.push(currentSession);
                    currentSession = [event];
                } else {
                    currentSession.push(event);
                }
            }
        }
        if (currentSession.length > 0) {
            sessions.push(currentSession);
        }

        // 2. Analyze each session and save to the database
        for (const sessionEvents of sessions) {
            try {
                this.analyzeAndSaveSession(userId, date, sessionEvents, productiveDomains, distractingDomains);
            } catch (err) {
                logger.error('Failed to parse a passive session', err);
            }
        }
    }

    private async analyzeAndSaveSession(
        userId: string,
        date: string,
        events: WebActivityEvent[],
        productiveSet: Set<string>,
        distractingSet: Set<string>
    ) {
        let totalActiveTime = 0;
        let contextSwitchCount = 0;
        let maxSingleFlowDuration = 0;
        let currentFlowDuration = 0;

        const timeInCategories = {
            productive: 0,
            distracting: 0,
            neutral: 0,
        };

        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            totalActiveTime += event.duration;

            let cat: 'productive' | 'distracting' | 'neutral' = 'neutral';
            if (productiveSet.has(event.domain)) cat = 'productive';
            else if (distractingSet.has(event.domain)) cat = 'distracting';

            timeInCategories[cat] += event.duration;

            // Context switch tracking
            if (i > 0 && events[i].domain !== events[i - 1].domain) {
                contextSwitchCount++;
                if (cat === 'distracting') {
                    // Break flow if we switch to a distraction
                    currentFlowDuration = 0;
                }
            }

            if (cat !== 'distracting') {
                currentFlowDuration += event.duration;
                if (currentFlowDuration > maxSingleFlowDuration) {
                    maxSingleFlowDuration = currentFlowDuration;
                }
            }
        }

        // Determine primary category
        let primaryCategory = 'neutral';
        if (timeInCategories.productive > timeInCategories.distracting && timeInCategories.productive > timeInCategories.neutral) {
            primaryCategory = 'productive';
        } else if (timeInCategories.distracting > timeInCategories.productive && timeInCategories.distracting > timeInCategories.neutral) {
            primaryCategory = 'distracting';
        }

        // 3. Triage Tier Selection (Zero Cost LLM Triage)
        const signalTier = this.determineSignalTier(totalActiveTime, contextSwitchCount, maxSingleFlowDuration, primaryCategory);

        // Calculate limits
        const startTime = new Date(events[0].startTime);
        const endTime = new Date(events[events.length - 1].endTime);

        // 4. Save Session
        const session = await PassiveSession.create({
            userId: new Types.ObjectId(userId),
            date,
            startTime,
            endTime,
            primaryCategory,
            metrics: {
                contextSwitchCount,
                flowDuration: maxSingleFlowDuration,
                totalActiveTime
            },
            rawLogs: events,
            signalTier
        });

        // 5. Triage to LLM Enrichment Queue if signal is strong enough
        if (signalTier === 'signal' || signalTier === 'deep_signal') {
            try {
                logger.info(`Triaging passive session ${session._id} for LLM Enrichment (Tier: ${signalTier})`);
                const enrichmentQueue = getEnrichmentQueue();
                if (enrichmentQueue) {
                    await enrichmentQueue.add(
                        'process-passive-enrichment',
                        {
                            userId: userId,
                            sourceType: SourceType.PASSIVE,
                            sessionId: session._id.toString(),
                            signalTier: signalTier
                        },
                        {
                            removeOnComplete: true,
                            removeOnFail: false
                        }
                    );
                }
            } catch (err) {
                logger.error('Failed to enqueue passive enrichment task:', err);
            }
        }

        // 6. Real-Time Wellness Nudge (Phase 4)
        if ((signalTier === 'signal' || signalTier === 'deep_signal') && primaryCategory === 'distracting') {
            const now = Date.now();
            const minsSinceEnd = (now - endTime.getTime()) / 60000;

            // Only nudge if the session just ended (happening right now)
            if (minsSinceEnd < 15) {
                try {
                    const totalMinutes = Math.round(totalActiveTime / 60);
                    const notif = await notificationService.create({
                        userId,
                        type: NotificationType.NUDGE,
                        title: 'Digital Wellness Nudge',
                        message: `You've been caught in a continuous distraction loop for ${totalMinutes} minutes. Might be a good time to take a breather?`,
                        eventId: `nudge_${session._id.toString()}` // Idempotency key
                    });
                    socketService.emitToUser(userId, SocketEvents.NOTIFICATION_NEW, notif);
                    logger.info(`Fired Nudge Notification for user ${userId} on session ${session._id}`);
                } catch (e) {
                    logger.error('Failed to trigger wellness nudge', e);
                }
            }
        }
    }

    private determineSignalTier(totalSeconds: number, switches: number, flowSeconds: number, primaryCategory: string): SignalTier {
        const totalMinutes = totalSeconds / 60;
        const flowMinutes = flowSeconds / 60;

        // Noise: Less than 10 mins of scattered activity. Nothing interesting.
        if (totalMinutes < 10) {
            return SignalTier.NOISE;
        }

        // Signal: Extremely long flow (Deep work) OR high erratic behavior (Doomscroll/Distraction loop)
        const highSwitchRate = switches / totalMinutes > 1.0; // More than 1 switch per minute for over 10 minutes

        if (flowMinutes > SUBSTANTIAL_FLOW_MINUTES || (primaryCategory === 'distracting' && highSwitchRate)) {
            // Flow state OR Doomscrolling loop are important psychological signals.
            return SignalTier.SIGNAL;
        }

        // Log: Medium activity, standard day-to-day operations
        return SignalTier.LOG;
    }
}

export const passiveAnalysisService = new PassiveAnalysisService();
