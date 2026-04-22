import { SourceType } from "./enrichment.enums";

// ───────────────────────────────────────────────────────────────────────────────
// HEALING CONFIG
// ───────────────────────────────────────────────────────────────────────────────

export const HEALING_BATCH_SIZE = 20;
export const MAX_HEALING_ATTEMPTS = 3;
export const HEALING_STALENESS_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

// ───────────────────────────────────────────────────────────────────────────────
// ENRICHMENT TAXONOMY
// ───────────────────────────────────────────────────────────────────────────────

export const ENRICHMENT_TAXONOMY = [
  'identity',
  'meaning',
  'spirituality',
  'growth',
  'control',
  'freedom',
  'ambition',
  'work',
  'finances',
  'status',
  'relationships',
  'family',
  'friends',
  'social',
  'adventure',
  'creativity',
  'leisure',
  'play',
  'health',
  'security',
  'environment',
  'time',
  'contribution',
] as const;

export type EnrichmentTheme = typeof ENRICHMENT_TAXONOMY[number];

// ───────────────────────────────────────────────────────────────────────────────
// PASSIVE ENRICHMENT GATE
// ───────────────────────────────────────────────────────────────────────────────

export const SIGNIFICANCE_GATE_SCORE = 40;

export const calculateSignificanceScore = (minActive: number, interactionFactor: number): number => {
  return Math.round((minActive / 240 * 60) + (interactionFactor / 50 * 40));
};

export const calculateSessionSignificance = (totalSeconds: number, interactionCount: number = 0): { score: number; minActive: number; interactionFactor: number } => {
  const minActive = Math.round(totalSeconds / 60);
  const interactionFactor = interactionCount > 0 ? interactionCount : (totalSeconds > 0 ? 10 : 0);
  const score = calculateSignificanceScore(minActive, interactionFactor);
  return { score, minActive, interactionFactor };
};

// ───────────────────────────────────────────────────────────────────────────────
// SYSTEM PERSONAS
// ───────────────────────────────────────────────────────────────────────────────

export const SYSTEM_PERSONAS: Record<SourceType, string> = {
  [SourceType.ACTIVE]: `You are the "Active Signal Extractor". Your goal is to process a user's conscious input (journal entry, voice memo, etc.) into a high-fidelity psychological signal.
  Extract themes from the strict taxonomy provided.
  Be precise, capture the emotional subtext, and identify key people or entities mentioned.`,

  [SourceType.PASSIVE]: `You are the "Behavioral Engine". Your goal is to process a batch of behavioral logs (URLs, App titles, active time) and infer the user's focus, cognitive load, and likely mental state.
  Do not hallucinate specific thoughts, but infer broader patterns of work or distraction based on the logs.`
} as const;

// ───────────────────────────────────────────────────────────────────────────────
// SIGNAL CLASSIFIER — SCORING VOCABULARY
// ───────────────────────────────────────────────────────────────────────────────

/** First-person introspective phrases — indicate self-directed thought. Weight: +4 each. */
export const INTROSPECTIVE_PHRASES = [
  "i feel", "i felt", "i think", "i thought", "i realize", "i realized",
  "i wonder", "i'm wondering", "i notice", "i noticed", "i believe",
  "i need", "i want", "i wish", "i hope", "i fear", "i'm afraid",
  "i hate", "i love", "i miss", "i regret", "i'm proud", "i'm ashamed",
  "i'm excited", "i'm worried", "i'm scared", "i'm anxious",
  "i'm overwhelmed", "i'm happy", "i'm sad", "i'm frustrated",
  "i'm confused", "i'm lost", "i'm tired", "i don't know", "i keep",
  "i can't", "i couldn't", "i should", "i shouldn't", "i must",
  "i have to", "i don't want to", "i've been", "i've always",
  "i've never", "i'm starting to", "i'm beginning to", "i'm becoming",
  "i'm not sure", "i'm so", "it's making me", "it made me",
  "something about", "part of me", "deep down", "i just feel",
  "i honestly", "i genuinely", "i truly", "i actually feel",
  "i keep thinking", "i keep coming back", "i can't stop thinking",
  "i don't understand why", "i know i should", "i know i shouldn't",
  "i'm starting to think", "i'm not okay", "i'm doing okay",
  "i'm better", "i'm worse", "i've been feeling", "i've been thinking",
] as const;

/** Positive emotional vocabulary. Weight: +3 each. */
export const POSITIVE_EMOTION_WORDS = [
  "joy", "happy", "happiness", "excited", "excitement", "proud", "pride",
  "grateful", "gratitude", "love", "loved", "hopeful", "hope", "inspired",
  "inspiration", "content", "peace", "peaceful", "relief", "relieved",
  "energized", "motivated", "confident", "optimistic", "thrilled", "ecstatic",
  "delighted", "fulfilled", "satisfied", "blessed", "appreciated", "elated",
  "joyful", "warmth", "alive", "free", "liberated", "grounded", "clear",
  "renewed", "refreshed", "enthusiastic", "passionate", "driven",
  "accomplished", "victorious", "seen", "understood", "valued", "safe",
  "great", "good", "excellent", "wonderful", "amazing", "awesome",
] as const;

/** Negative emotional vocabulary. Weight: +3 each. */
export const NEGATIVE_EMOTION_WORDS = [
  "anxious", "anxiety", "scared", "afraid", "fear", "worried", "worry",
  "stressed", "stress", "overwhelmed", "frustrated", "frustration", "angry",
  "anger", "sad", "sadness", "depressed", "depression", "lonely", "loneliness",
  "guilty", "guilt", "ashamed", "shame", "regret", "regretful",
  "disappointed", "disappointment", "lost", "confused", "confusion",
  "hopeless", "helpless", "hurt", "exhausted", "drained", "empty", "numb",
  "restless", "insecure", "jealous", "bitter", "resentful", "disgusted",
  "panicked", "terrified", "devastated", "broken", "defeated", "stuck",
  "trapped", "suffocating", "suffocated", "paralyzed", "reckless",
  "hollow", "disconnected", "alienated", "invisible", "unworthy",
  "inadequate", "failing", "failing myself", "failing others",
] as const;

/** Complex or ambivalent emotional vocabulary. Weight: +3 each. */
export const COMPLEX_EMOTION_WORDS = [
  "nostalgic", "nostalgia", "bittersweet", "ambivalent", "conflicted",
  "torn", "uncertain", "doubt", "doubtful", "curious", "curiosity",
  "surprised", "shocked", "vulnerable", "exposed", "uncomfortable",
  "unsettled", "uneasy", "weird", "strange", "mixed feelings", "complicated",
  "heavy", "tight", "raw", "off", "not myself", "unlike myself",
  "something's off", "not right", "hard to explain", "can't quite",
] as const;

/** Cognitive contradiction markers — indicate nuanced or conflicted thinking. Weight: +3, capped once per entry. */
export const CONTRADICTION_MARKERS = [
  "but", "however", "even though", "although", "yet", "despite",
  "nevertheless", "still", "whereas", "on the other hand",
  "at the same time", "paradoxically", "ironically", "even so",
  "that said", "then again", "except", "unless", "while", "and yet",
  "in spite of", "regardless", "somehow", "strangely enough",
] as const;

/** Temporal perspective markers — non-moment thinking, pattern recognition. Weight: +3, capped once per entry. */
export const TEMPORAL_PERSPECTIVE_MARKERS = [
  "lately", "recently", "for a while", "always", "never", "used to",
  "anymore", "these days", "for months", "for years", "since", "ever since",
  "going forward", "from now on", "for so long", "over time", "gradually",
  "for as long as i can remember", "for the past", "still haven't",
  "keep coming back to", "keep thinking about", "for the longest time",
  "after all this time", "eventually", "before i knew it",
] as const;

/** Meta-cognitive markers — thinking about one's own mental state. Weight: +3, capped once per entry. */
export const META_COGNITIVE_MARKERS = [
  "realize", "realized", "understand", "understood", "see now",
  "starting to see", "beginning to understand", "becoming aware",
  "noticed that", "it hit me", "it dawned on me", "makes sense now",
  "finally get", "can't figure out", "trying to make sense",
  "piecing together", "coming to terms", "processing", "sitting with",
  "unpacking", "working through", "starting to accept", "coming to realize",
  "it occurred to me", "i'm seeing", "i'm learning", "i'm getting better at",
  "i'm still learning", "i'm trying to", "i'm trying not to",
] as const;

/** Decision and agency markers — committing, choosing, letting go. Weight: +3, capped once per entry. */
export const DECISION_MARKERS = [
  "decided", "choosing", "choice", "going to", "will not", "won't",
  "committing", "determined", "resolve", "giving up on", "moving on",
  "letting go", "starting fresh", "drawing a line", "enough is enough",
  "making a change", "no more", "from now on", "i've made up my mind",
  "i'm done", "i'm done with", "i'm committing", "this is it",
  "i've decided", "i need to stop", "i need to start", "i'm going to",
] as const;

/** Desire and aspiration markers. Weight: +2, capped once per entry. */
export const DESIRE_MARKERS = [
  "wish", "dream", "long for", "yearn", "aspire", "someday", "one day",
  "if only", "imagine if", "wanted to", "always wanted", "been wanting",
  "hope to", "want more than", "need to find", "looking for",
  "searching for", "trying to find",
] as const;

/** Fear and avoidance markers. Weight: +2, capped once per entry. */
export const AVOIDANCE_MARKERS = [
  "avoid", "avoiding", "dread", "dreading", "procrastinating",
  "putting off", "can't face", "not ready", "running from",
  "hiding from", "pretending", "ignoring", "not dealing with",
  "pushing away", "burying", "suppressing",
] as const;

/** Self-perception markers — how user sees or describes themselves. Weight: +3, capped once per entry. */
export const SELF_PERCEPTION_MARKERS = [
  "i am the kind of", "i've always been", "i've never been",
  "people think i", "others see me", "i see myself", "i used to be",
  "i'm becoming", "i'm turning into", "what i really am", "who i am",
  "kind of person", "type of person", "i'm not the", "i'm exactly the",
  "i've always known i", "i'm starting to see myself",
] as const;

// ───────────────────────────────────────────────────────────────────────────────
// SIGNAL CLASSIFIER — NOISE DAMPENERS
// ───────────────────────────────────────────────────────────────────────────────

/** Trivial single-action verbs — indicative of pure factual logs. Weight: penalty when combined with short content and no first-person. */
export const TRIVIAL_ACTIVITY_VERBS = [
  "watched", "woke", "slept", "ate", "had", "went", "came", "got",
  "took", "made", "saw", "met", "left", "arrived", "finished",
  "started", "called", "messaged", "bought", "ordered", "paid",
  "walked", "ran", "drove", "cooked", "cleaned", "showered",
  "read", "played", "listened", "worked", "studied",
] as const;

/** Time-anchoring phrases that indicate event-recording rather than reflection. Weight: penalty when content is short. */
export const TIME_ANCHORS = [
  " at ", "am", "pm", "this morning", "this evening", "tonight",
  "last night", "this afternoon", "today at", "earlier today",
  "just now", "a few minutes ago", "an hour ago",
] as const;

/** Words that indicate a meaningful factual log (work, fitness, study) which should push it out of noise. Weight: +5 each. */
export const LOG_BOOSTER_WORDS = [
  "meeting", "call", "project", "work", "client", "task", "roadmap", "mockup",
  "design", "code", "feature", "bug", "fix", "deploy", "release", "sprint",
  "presentation", "demo", "review", "email", "report", "brief", "run", "gym",
  "workout", "exercise", "training", "practice", "study", "exam", "reading",
] as const;

// ───────────────────────────────────────────────────────────────────────────────
// SIGNAL CLASSIFIER — SCORING WEIGHTS
// ───────────────────────────────────────────────────────────────────────────────

export const SIGNAL_SCORING_WEIGHTS = {
  INTROSPECTIVE_PHRASE: 10,
  EMOTIONAL_WORD: 3,
  LOG_BOOSTER: 4,
  CONTRADICTION_MARKER: 3,       // capped: 1 match per category
  TEMPORAL_MARKER: 3,            // capped: 1 match per category
  META_COGNITIVE: 3,             // capped: 1 match per category
  DECISION_MARKER: 3,            // capped: 1 match per category
  SELF_PERCEPTION: 3,            // capped: 1 match per category
  DESIRE_MARKER: 2,              // capped: 1 match per category
  AVOIDANCE_MARKER: 2,           // capped: 1 match per category
  QUESTION_MARK: 4,
  WORD_COUNT_25_60: 4,
  WORD_COUNT_60_120: 8,
  WORD_COUNT_OVER_120: 12,
  IS_VOICE: 3,
  IS_IMPORTANT: 20,              // forces deep_signal
  // Penalties
  VERY_SHORT: -5,                // < 8 words
  NO_FIRST_PERSON_SHORT: -3,     // no "I" + < 15 words
  TRIVIAL_ONLY: -3,              // single trivial verb clause, short, no first-person
  TIME_ANCHOR_PENALTY: -5,       // time anchor + < 12 words
  MEDIA_NO_TEXT: -10,            // media only, no text content
} as const;

// ───────────────────────────────────────────────────────────────────────────────
// SIGNAL CLASSIFIER — TIER THRESHOLDS
// ───────────────────────────────────────────────────────────────────────────────

export const SIGNAL_TIER_THRESHOLDS = {
  NOISE_MAX: -8,    // MVP: very few entries are noise. TODO: IDEALLY: score <= -5 → noise.
  LOG_MAX: -5,       // MVP: few entries are logs. TODO: IDEALLY: score -4 to 5 → log
  SIGNAL_MAX: 20,   // MVP: most entries are signals. TODO: IDEALLY: score 6 to 20 → signal
  // TODO: IDEALLY: score > 20 → deep_signal
} as const;
