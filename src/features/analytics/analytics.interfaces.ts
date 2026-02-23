import { IKnowledgeEntity } from '../entity/entity.interfaces';
import { ITag } from '../tag/tag.interfaces';

// Analytics Types
export interface AnalysisOutput {
  summary?: string;
  highlights?: string[];
  recommendations?: string[];
  [key: string]: any;
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


export interface IAnalyticsService {
  getAnalytics(userId: string, options?: AnalyticsRequest): Promise<AnalyticsData>;
  getGraphData(userId: string): Promise<any>;
  getStreak(userId: string): Promise<any>;
  getPatterns(userId: string): Promise<any>;
  getWeeklySummary(userId: string): Promise<any>;
  getEntryFrequency(userId: string): Promise<any>;
  getEntryAnalytics(userId: string, options?: AnalyticsRequest): Promise<any>;
  getMediaAnalytics(userId: string, options?: AnalyticsRequest): Promise<any>;
}

export interface IAnalyticsAdminService {
  getUserGrowth(): Promise<any[]>;
  getContentGrowth(): Promise<any[]>;
  getFeatureStats(): Promise<any>;
  getFeatureUsageBreakdown(): Promise<any>;
  getRetentionStats(): Promise<any[]>;
  getUserAccountStats(): Promise<any>;
  getActiveUserStats(): Promise<any>;
  getPlatformStats(): Promise<any[]>;
  getDashboardStats(): Promise<any>;
}

export interface IAnalyticsGraphService {
  getGraphData(userId: string): Promise<{ nodes: any[]; links: any[]; }>;
}

export interface IAnalyticsInsightsService {
  getStreak(userId: string): Promise<any>;
  getPatterns(userId: string): Promise<any[]>;
  getWeeklySummary(userId: string): Promise<any>;
}




