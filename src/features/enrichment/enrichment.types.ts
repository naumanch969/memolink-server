import { Document, Types } from 'mongoose';
import { BaseEntity } from '../../shared/types';

export type SourceType = 'active' | 'passive';
export type InputMethod = 'text' | 'voice' | 'whatsapp' | 'system';
export type ProcessingStatus = 'pending' | 'completed' | 'failed';
export type EnergyLevel = 'low' | 'medium' | 'high';
export type CognitiveLoad = 'focused' | 'scattered' | 'ruminating';

export interface IEnrichmentMetadata {
    themes: string[]; // max 3, from strict taxonomy
    emotions: Array<{ label: string; intensity: number }>; // label from fixed taxonomy
    entities: Array<{
        entityId?: Types.ObjectId;
        name: string;
        type: 'person' | 'place' | 'concept' | 'project' | 'organization';
        confidence: number;
        source: 'user' | 'extracted';
    }>;
    sentimentScore: number; // -1.0 to 1.0
    energyLevel: EnergyLevel;
    cognitiveLoad: CognitiveLoad;
}

export interface IEnrichmentNarrative {
    signal: string; // 3-5 sentence psychological interpretation
    coreThought: string; // single most dominant thought/concern
    contradictions: string[]; // where stated belief conflicts with emotion/behavior
    openLoops: string[]; // unresolved questions, decisions, or tensions
    selfPerception: string; // how the user sees themselves
    desires: string[]; // what the user wants
    fears: string[]; // what the user is afraid of
}

export interface IEnrichedEntry extends BaseEntity {
    userId: Types.ObjectId;
    sessionId: string; // 4-hour window anchor
    referenceId?: Types.ObjectId; // Link to raw Entry if active, null for passive

    sourceType: SourceType;
    inputMethod: InputMethod;
    processingStatus: ProcessingStatus;

    metadata: IEnrichmentMetadata;
    narrative: IEnrichmentNarrative;

    extraction: {
        confidenceScore: number; // 0.0 - 1.0
        modelVersion: string;
        flags: string[]; // audit trail: "ambiguous", "parse_fallback", etc.
    };

    analytics: {
        totalDuration: number; // minutes
        topApp?: string; // for passive entries
        significanceScore: number; // gate formula result
    };

    embedding: number[]; // float[1536]
    timestamp: Date; // original input timestamp
}

export type IEnrichedEntryDocument = IEnrichedEntry & Document;

export interface IUsageStats extends BaseEntity {
    userId: Types.ObjectId;
    sessionId: string; // 4-hour window anchor
    date: string; // YYYY-MM-DD

    totalSeconds: number;
    productiveSeconds: number;
    distractingSeconds: number;

    domainMap: Map<string, number>;

    topDomains: Array<{
        domain: string;
        seconds: number;
    }>;

    appStats: Array<{
        appName: string;
        duration: number;
        interactions: number;
    }>;

    lastUpdated?: Date;
}

export type IUsageStatsDocument = IUsageStats & Document;

export interface IEnrichmentResult {
    metadata: Partial<IEnrichmentMetadata>;
    narrative: Partial<IEnrichmentNarrative>;
    extraction: {
        confidenceScore: number;
        modelVersion?: string;
        flags: string[];
    };
    analytics?: Partial<IEnrichedEntry['analytics']>;
}

export interface IEnrichmentInterpreter<TInput, TOutput extends IEnrichmentResult = IEnrichmentResult> {
    process(input: TInput): Promise<TOutput>;
}

export interface EnrichmentJobData {
    userId: string;
    sourceType: 'active' | 'passive';
    sessionId: string;
    referenceId?: string;
}
