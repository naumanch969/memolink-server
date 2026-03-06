import { Document, Types } from 'mongoose';
import { BaseEntity } from '../../shared/types';

export type SourceType = 'active' | 'passive';
export type InputMethod = 'text' | 'voice' | 'whatsapp' | 'system';
export type ProcessingStatus = 'pending' | 'completed' | 'failed';
export type EnergyLevel = 'low' | 'medium' | 'high';
export type CognitiveLoad = 'focused' | 'scattered' | 'ruminating';

export interface IEnrichmentMetadata {
    themes: string[];
    emotions: Array<{ name: string; score: number; icon: string }>;
    people: Array<{ name: string; role: string; sentiment: number }>;
    entities?: Array<{ entityId?: Types.ObjectId; name: string; type: string; confidence?: number }>;
    sentimentScore: number;
    energyLevel: EnergyLevel;
    cognitiveLoad: CognitiveLoad;
}

export interface IEnrichedEntry extends BaseEntity {
    userId: Types.ObjectId;
    sessionId: string; // 4-hour window anchor
    referenceId?: Types.ObjectId; // Link to raw Entry if active

    sourceType: SourceType;
    inputMethod: InputMethod;
    processingStatus: ProcessingStatus;

    content: string; // Psychological Signal (Condensed Narrative or Raw Reflection)

    metadata: IEnrichmentMetadata;

    extraction: {
        confidenceScore: number; // 0.0 - 1.0 (Downstream throttle)
        modelVersion: string;
        flags: string[]; // ["ambiguous", "parse_fallback"]
    };

    analytics: {
        totalDuration: number; // Representation in minutes
        topApp?: string;
        significanceScore: number;
    };

    embedding: number[]; // float[1536]
    timestamp: Date;
}

export type IEnrichedEntryDocument = IEnrichedEntry & Document;

export interface IUsageStats extends BaseEntity {
    userId: Types.ObjectId;
    sessionId: string; // 4-hour window anchor
    date: string; // YYYY-MM-DD

    totalSeconds: number;
    productiveSeconds: number;
    distractingSeconds: number;

    topDomains: Array<{
        domain: string;
        seconds: number;
    }>;

    appStats: Array<{
        appName: string;
        duration: number;
        interactions: number;
    }>;

    lastUpdated: Date;
}

export type IUsageStatsDocument = IUsageStats & Document;

export interface IEnrichmentResult {
    content: string;
    metadata: Partial<IEnrichmentMetadata>;
    extraction: {
        confidenceScore: number;
        flags: string[];
    };
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
