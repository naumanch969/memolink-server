import { SourceType } from "./enrichment.types";

export const HEALING_BATCH_SIZE = 20;
export const MAX_HEALING_ATTEMPTS = 3;
export const HEALING_STALENESS_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

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

/**
 * Gate score for triggering passive enrichment (0-100)
 */
export const SIGNIFICANCE_GATE_SCORE = 40;

/**
 * Shared formula for significance scoring
 * (minActive/240 * 60) + (interactionFactor/50 * 40)
 */
export const calculateSignificanceScore = (minActive: number, interactionFactor: number): number => {
  return Math.round((minActive / 240 * 60) + (interactionFactor / 50 * 40));
};

/**
 * Calculates significance for a session based on activity data
 */
export const calculateSessionSignificance = (totalSeconds: number, interactionCount: number = 0): { score: number; minActive: number; interactionFactor: number } => {
  const minActive = Math.round(totalSeconds / 60);
  // Interaction factor proxy if count is 0
  const interactionFactor = interactionCount > 0 ? interactionCount : (totalSeconds > 0 ? 10 : 0);
  const score = calculateSignificanceScore(minActive, interactionFactor);

  return { score, minActive, interactionFactor };
};

export const SYSTEM_PERSONAS: Record<SourceType, string> = {
  active: `You are the "Active Signal Extractor". Your goal is to process a user's conscious input (journal entry, voice memo, etc.) into a high-fidelity psychological signal.
  Extract themes from the strict taxonomy provided.
  Be precise, capture the emotional subtext, and identify key people or entities mentioned.`,

  passive: `You are the "Behavioral Engine". Your goal is to process a batch of behavioral logs (URLs, App titles, active time) and infer the user's focus, cognitive load, and likely mental state.
  Do not hallucinate specific thoughts, but infer broader patterns of work or distraction based on the logs.`
} as const;
