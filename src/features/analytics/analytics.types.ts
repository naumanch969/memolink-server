import { IKnowledgeEntity } from "../entity/entity.types";
import { ITag } from "../tag/tag.types";

export interface AnalysisOutput {
    [key: string]: any;
    summary?: string;
    highlights?: string[];
    recommendations?: string[];
}

export interface AnalyticsData {
    totalEntries: number;
    entriesThisMonth: number;
    totalEntities: number;
    totalTags: number;
    totalMedia: number;
    entryFrequency: {
        daily: number[];
        weekly: number[];
        monthly: number[];
        };
    topEntities: Array<{
        entity: IKnowledgeEntity;
        interactionCount: number;
        }>;
    topTags: Array<{
        tag: ITag;
        usageCount: number;
        }>;
    mediaStats: {
        totalImages: number;
        totalVideos: number;
        totalDocuments: number;
        };
    latestReflection?: AnalysisOutput;
    latestWeeklyAnalysis?: AnalysisOutput;
}

export interface AnalyticsRequest {
    dateFrom?: string;
    dateTo?: string;
    period?: 'week' | 'month' | 'year';
}

export interface UserGrowthData {
    date: string;
    count: number;
}

export interface ContentGrowthData {
    date: string;
    entries: number;
    media: number;
}

export interface PlatformStats {
    platform: string;
    count: number;
    percentage: number;
}

export interface FeatureStats {
    users: number;
    entries: number;
    media: number;
    goals: number;
}

export interface UserAccountStats {
    roles: { role: string; count: number }[];
    verification: { status: string; count: number }[];
}

export interface ActiveUserStats {
    daily: number;
    weekly: number;
    monthly: number;
}

export interface FeatureUsageBreakdown {
    entryTypes: { type: string; count: number }[];
    mediaTypes: { type: string; count: number }[];
    mediaStorage: { type: string; size: number }[];
    topTags: { name: string; count: number }[];
    topEntities: { name: string; count: number }[];
}

export interface RetentionStats {
    cohort: string;
    retention: number;
}
