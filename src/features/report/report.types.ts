import { Types } from "mongoose";
import { BaseEntity } from "../../shared/types";

export interface DailyMoodPoint {
    date: string;   // YYYY-MM-DD
    score: number;
    note?: string;
}

export interface ReportContext {
    period: { start: Date; end: Date; type: ReportType };
    totalEntries: number;
    totalWords: number;
    avgMoodScore: number;
    moodTimeSeries: DailyMoodPoint[];
    entryNarrative: string;         // Full entry content for LLM prompt
    topTags: string[];              // "tag (Nx)" format, top 15
    topEntities: string[];          // top mentioned people/places with context
    personaMarkdown: string;        // UserPersona.rawMarkdown or empty
    webActivitySummary: string;     // Aggregated web-activity string or empty
    previousReport?: any;           // Last period's content for comparison
}

export interface IReport extends BaseEntity {
    userId: Types.ObjectId;
    type: ReportType;
    status: ReportStatus;
    startDate: Date;
    endDate: Date;
    content: any;
    metadata?: {
            viewCount?: number;
            lastViewedAt?: Date;
            generatedByTaskId?: Types.ObjectId;
        };
}

export interface CreateReportRequest {
    userId: string;
    type: ReportType;
    startDate: Date;
    endDate: Date;
    content: any;
    generatedByTaskId?: string;
}

export interface ReportSearchRequest {
    type?: ReportType;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}

export enum ReportType {
    WEEKLY = 'WEEKLY',
    MONTHLY = 'MONTHLY'
}

export enum ReportStatus {
    DRAFT = 'DRAFT',
    PUBLISHED = 'PUBLISHED',
    GENERATING = 'GENERATING',
    FAILED = 'FAILED',
    NOT_GENERATED = 'NOT_GENERATED'
}

export enum EnergyArc {
    ASCENDING = 'ascending',
    DESCENDING = 'descending',
    VOLATILE = 'volatile',
    FLAT = 'flat',
}

export enum PatternConfidence {
    STRONG = 'strong',
    EMERGING = 'emerging',
    TENTATIVE = 'tentative',
}

export enum MoodArc {
    GROWTH = 'growth',
    DECLINE = 'decline',
    RECOVERY = 'recovery',
    PLATEAU = 'plateau',
    TURBULENT = 'turbulent',
}
