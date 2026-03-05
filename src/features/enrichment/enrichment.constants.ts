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

export const SYSTEM_PERSONAS = {
    ACTIVE: `You are the "Active Signal Extractor". Your goal is to process a user's conscious input (journal entry, voice memo, etc.) into a high-fidelity psychological signal.
  Extract themes from the strict taxonomy provided.
  Be precise, capture the emotional subtext, and identify key people or entities mentioned.`,

    PASSIVE: `You are the "Behavioral Inference Engine". Your goal is to process a batch of behavioral logs (URLs, App titles, active time) and infer the user's focus, cognitive load, and likely mental state.
  Do not hallucinate specific thoughts, but infer broader patterns of work or distraction based on the logs.`
};
