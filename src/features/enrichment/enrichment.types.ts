import { Document, Types } from 'mongoose';
import { z } from 'zod';
import { BaseEntity } from '../../shared/types';
import { ENRICHMENT_TAXONOMY } from './enrichment.constants';

export type SourceType = 'active' | 'passive';
export type InputMethod = 'text' | 'voice' | 'whatsapp' | 'system';
export type ProcessingStatus = 'pending' | 'completed' | 'failed';
export type EnergyLevel = 'low' | 'medium' | 'high';
export type CognitiveLoad = 'focused' | 'scattered' | 'ruminating';
export enum ProcessingStep {
    ANALYZING_INTENT = 'analyzing_intent',
    INDEXING = 'indexing',
    RESOLVING_ENTITIES = 'resolving_entities',
    STORING_MEMORY = 'storing_memory'
}

// --- Zod Schemas (Source of Truth) ---

export const EnrichmentMetadataSchema = z.object({
    themes: z.array(z.enum(ENRICHMENT_TAXONOMY)).max(3),
    emotions: z.array(z.object({
        label: z.string(),
        intensity: z.number().min(0).max(1)
    })),
    entities: z.array(z.object({
        entityId: z.any().optional(), // In-memory/DB ID
        name: z.string(),
        type: z.enum(['person', 'place', 'concept', 'project', 'organization']),
        confidence: z.number().min(0).max(1),
        source: z.enum(['user', 'extracted'])
    })),
    sentimentScore: z.number().min(-1).max(1),
    energyLevel: z.enum(['low', 'medium', 'high']),
    cognitiveLoad: z.enum(['focused', 'scattered', 'ruminating']),
});

export const EnrichmentNarrativeSchema = z.object({
    signal: z.string(),
    coreThought: z.string(),
    contradictions: z.array(z.string()),
    openLoops: z.array(z.string()),
    selfPerception: z.string(),
    desires: z.array(z.string()),
    fears: z.array(z.string()),
});

export const EnrichmentResultSchema = z.object({
    metadata: EnrichmentMetadataSchema,
    narrative: EnrichmentNarrativeSchema,
    extraction: z.object({
        confidenceScore: z.number().min(0).max(1),
        flags: z.array(z.string())
    })
});

// --- Inferred Types ---

export type IEnrichmentMetadata = z.infer<typeof EnrichmentMetadataSchema>;
export type IEnrichmentNarrative = z.infer<typeof EnrichmentNarrativeSchema>;
export type IEnrichmentResult = z.infer<typeof EnrichmentResultSchema>;

export interface IEnrichedEntry extends BaseEntity {
    userId: Types.ObjectId;
    sessionId: string;
    referenceId?: Types.ObjectId;

    sourceType: SourceType;
    inputMethod: InputMethod;
    processingStatus: ProcessingStatus;

    metadata: IEnrichmentMetadata;
    narrative: IEnrichmentNarrative;

    extraction: {
        confidenceScore: number;
        modelVersion: string;
        flags: string[];
    };

    analytics: {
        totalDuration: number;
        topApp?: string;
        significanceScore: number;
    };

    embedding: number[];
    healingAttempts: number;
    timestamp: Date;
}

export type IEnrichedEntryDocument = IEnrichedEntry & Document;
export type IActiveEnrichmentResult = IEnrichmentResult;
export type IPassiveEnrichmentResult = IEnrichmentResult;

export interface IEnrichmentInterpreter<TInput, TOutput extends IEnrichmentResult = IEnrichmentResult> {
    process(input: TInput): Promise<TOutput>;
}

export interface EnrichmentJobData {
    userId: string;
    sourceType: SourceType;
    sessionId: string;
    referenceId?: string;
}

export interface EnrichmentStrategyInput {
    userId: string;
    sessionId: string;
    referenceId?: string;
}

export interface EnrichmentStrategyOutput {
    result: IEnrichmentResult;
    contentForEmbedding: string;
    analyticsData: {
        totalDuration: number;
        topApp?: string;
        significanceScore: number;
    };
    extractionFlags: string[];
    timestamp: Date;
    inputMethod: InputMethod;
}

export interface IEnrichmentStrategy {
    execute(input: EnrichmentStrategyInput): Promise<EnrichmentStrategyOutput>;
}
