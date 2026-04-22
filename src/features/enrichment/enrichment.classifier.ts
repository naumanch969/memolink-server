import { AVOIDANCE_MARKERS, COMPLEX_EMOTION_WORDS, CONTRADICTION_MARKERS, DECISION_MARKERS, DESIRE_MARKERS, INTROSPECTIVE_PHRASES, LOG_BOOSTER_WORDS, META_COGNITIVE_MARKERS, NEGATIVE_EMOTION_WORDS, POSITIVE_EMOTION_WORDS, SELF_PERCEPTION_MARKERS, SIGNAL_SCORING_WEIGHTS, SIGNAL_TIER_THRESHOLDS, TEMPORAL_PERSPECTIVE_MARKERS, TIME_ANCHORS, TRIVIAL_ACTIVITY_VERBS, } from './enrichment.constants';
import { SignalTier } from './enrichment.types';

export interface ClassificationResult {
    readonly tier: SignalTier;
    readonly score: number;
    readonly breakdown: Readonly<Record<string, number>>;
}

const ALL_EMOTION_WORDS = [
    ...POSITIVE_EMOTION_WORDS,
    ...NEGATIVE_EMOTION_WORDS,
    ...COMPLEX_EMOTION_WORDS,
] as const;

export class EntryClassifier {

    classify(content: string, isImportant: boolean, isVoice: boolean): ClassificationResult {
        // Hard override: user-declared importance forces deep_signal
        if (isImportant) {
            return {
                tier: SignalTier.DEEP_SIGNAL,
                score: SIGNAL_SCORING_WEIGHTS.IS_IMPORTANT,
                breakdown: { is_important: SIGNAL_SCORING_WEIGHTS.IS_IMPORTANT },
            };
        }

        // Hard override: no content at all
        if (!content || content.trim().length === 0) {
            return { tier: SignalTier.NOISE, score: -10, breakdown: { empty_content: -10 } };
        }

        const lower = content.toLowerCase();
        const wordCount = content.trim().split(/\s+/).length;
        const breakdown: Record<string, number> = {};
        let score = 0;

        const add = (key: string, pts: number): void => {
            breakdown[key] = (breakdown[key] ?? 0) + pts;
            score += pts;
        };

        // ─── Voice bonus ────────────────────────────────────────────────────────
        if (isVoice) add('is_voice', SIGNAL_SCORING_WEIGHTS.IS_VOICE);

        // ─── Word count bands ───────────────────────────────────────────────────
        if (wordCount < 8) {
            add('very_short', SIGNAL_SCORING_WEIGHTS.VERY_SHORT);
        } else if (wordCount >= 25 && wordCount < 60) {
            add('word_count_25_60', SIGNAL_SCORING_WEIGHTS.WORD_COUNT_25_60);
        } else if (wordCount >= 60 && wordCount <= 120) {
            add('word_count_60_120', SIGNAL_SCORING_WEIGHTS.WORD_COUNT_60_120);
        } else if (wordCount > 120) {
            add('word_count_over_120', SIGNAL_SCORING_WEIGHTS.WORD_COUNT_OVER_120);
        }

        // ─── No first-person subject + short ───────────────────────────────────
        const hasFirstPerson = lower.startsWith('i ') || lower.includes(' i ') || lower.includes("\ni ");
        if (!hasFirstPerson && wordCount < 15) {
            add('no_first_person_short', SIGNAL_SCORING_WEIGHTS.NO_FIRST_PERSON_SHORT);
        }

        // ─── Time anchor with minimal content ──────────────────────────────────
        if (wordCount < 12) {
            for (const anchor of TIME_ANCHORS) {
                if (lower.includes(anchor)) {
                    add('time_anchor_penalty', SIGNAL_SCORING_WEIGHTS.TIME_ANCHOR_PENALTY);
                    break; // apply penalty once
                }
            }
        }

        // ─── Trivial-only entry (short, no introspection, single action verb) ──
        if (wordCount < 10 && !hasFirstPerson) {
            for (const verb of TRIVIAL_ACTIVITY_VERBS) {
                if (lower.startsWith(verb) || lower.includes(` ${verb} `)) {
                    add('trivial_only', SIGNAL_SCORING_WEIGHTS.TRIVIAL_ONLY);
                    break; // apply penalty once
                }
            }
        }

        // ─── Media with no real text ────────────────────────────────────────────
        if (content.trim().length < 3) {
            add('media_no_text', SIGNAL_SCORING_WEIGHTS.MEDIA_NO_TEXT);
        }

        // ─── Introspective phrases (uncapped — each occurrence adds weight) ────
        for (const phrase of INTROSPECTIVE_PHRASES) {
            if (lower.includes(phrase)) {
                add('introspective', SIGNAL_SCORING_WEIGHTS.INTROSPECTIVE_PHRASE);
            }
        }

        // ─── Emotional vocabulary (uncapped — each distinct word adds weight) ──
        for (const word of ALL_EMOTION_WORDS) {
            if (lower.includes(word)) {
                add('emotion', SIGNAL_SCORING_WEIGHTS.EMOTIONAL_WORD);
            }
        }

        // ─── Question mark (self-directed reflection) ───────────────────────────
        if (content.includes('?')) {
            add('question_mark', SIGNAL_SCORING_WEIGHTS.QUESTION_MARK);
        }

        // ─── Log boosters (uncapped — help work/fitness logs overcome noise penalties) ─
        for (const word of LOG_BOOSTER_WORDS) {
            if (lower.includes(word)) {
                add('log_booster', SIGNAL_SCORING_WEIGHTS.LOG_BOOSTER);
            }
        }

        // ─── Capped categories (first match wins per category) ──────────────────
        for (const marker of CONTRADICTION_MARKERS) {
            if (lower.includes(marker)) {
                add('contradiction', SIGNAL_SCORING_WEIGHTS.CONTRADICTION_MARKER);
                break;
            }
        }
        for (const marker of TEMPORAL_PERSPECTIVE_MARKERS) {
            if (lower.includes(marker)) {
                add('temporal_perspective', SIGNAL_SCORING_WEIGHTS.TEMPORAL_MARKER);
                break;
            }
        }
        for (const marker of META_COGNITIVE_MARKERS) {
            if (lower.includes(marker)) {
                add('meta_cognitive', SIGNAL_SCORING_WEIGHTS.META_COGNITIVE);
                break;
            }
        }
        for (const marker of DECISION_MARKERS) {
            if (lower.includes(marker)) {
                add('decision', SIGNAL_SCORING_WEIGHTS.DECISION_MARKER);
                break;
            }
        }
        for (const marker of SELF_PERCEPTION_MARKERS) {
            if (lower.includes(marker)) {
                add('self_perception', SIGNAL_SCORING_WEIGHTS.SELF_PERCEPTION);
                break;
            }
        }
        for (const marker of DESIRE_MARKERS) {
            if (lower.includes(marker)) {
                add('desire', SIGNAL_SCORING_WEIGHTS.DESIRE_MARKER);
                break;
            }
        }
        for (const marker of AVOIDANCE_MARKERS) {
            if (lower.includes(marker)) {
                add('avoidance', SIGNAL_SCORING_WEIGHTS.AVOIDANCE_MARKER);
                break;
            }
        }

        // ─── Tier resolution ────────────────────────────────────────────────────
        const tier = EntryClassifier.resolveToTier(score);
        return { tier, score, breakdown: Object.freeze(breakdown) };
    }

    private static resolveToTier(score: number): SignalTier {
        if (score <= SIGNAL_TIER_THRESHOLDS.NOISE_MAX) return SignalTier.NOISE;
        if (score <= SIGNAL_TIER_THRESHOLDS.LOG_MAX) return SignalTier.LOG;
        if (score <= SIGNAL_TIER_THRESHOLDS.SIGNAL_MAX) return SignalTier.SIGNAL;
        return SignalTier.DEEP_SIGNAL;
    }
}

export const entryClassifier = new EntryClassifier();
