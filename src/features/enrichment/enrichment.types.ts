import { Document, Types } from 'mongoose';
import { z } from 'zod';
import { BaseEntity } from '../../shared/types';
import { 
    SignalTier, 
    SourceType, 
    InputMethod, 
    ProcessingStatus, 
    EnergyLevel, 
    CognitiveLoad, 
    ProcessingStep, 
    EntityType, 
    EntitySource 
} from './enrichment.enums';
import { ENRICHMENT_TAXONOMY } from './enrichment.constants';

export {
    SignalTier,
    SourceType,
    InputMethod,
    ProcessingStatus,
    EnergyLevel,
    CognitiveLoad,
    ProcessingStep,
    EntityType,
    EntitySource
};

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
        type: z.nativeEnum(EntityType),
        confidence: z.number().min(0).max(1),
        source: z.nativeEnum(EntitySource)
    })),
    sentimentScore: z.number().min(-1).max(1),
    energyLevel: z.nativeEnum(EnergyLevel),
    cognitiveLoad: z.nativeEnum(CognitiveLoad),
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
    signalTier: SignalTier;

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
    signalTier?: SignalTier;
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
