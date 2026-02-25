import { AnalyticsData, AnalyticsRequest } from "./analytics.types";

// Analytics Types

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




