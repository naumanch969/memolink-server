import { Document, Types } from 'mongoose';
import { AnalyticsData } from '../../shared/types';

export interface IAnalyticsService {
  getAnalytics(userId: string, options?: AnalyticsRequest): Promise<AnalyticsData>;
}

export interface AnalyticsResponse {
  analytics: AnalyticsData;
}

export interface AnalyticsRequest {
  dateFrom?: string;
  dateTo?: string;
  includePrivate?: boolean;
}

// Merged from Insights
export enum InsightType {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export interface IInsight extends Document {
  userId: Types.ObjectId;
  type: InsightType;
  periodStart: Date;
  periodEnd: Date;
  data: InsightData;
  createdAt: Date;
}

export interface InsightData {
  totalEntries: number;
  wordCount?: number;
  mostMentionedPeople: { personId: string; name: string; count: number }[];
  mostUsedTags: { tagId: string; name: string; count: number }[];
  moodTrend: { mood: string; count: number }[];
  streak: number;
  highlights?: { date: Date; entryId: string; reason: string }[];
  comparison?: {
    lastPeriodEntries: number;
    changePercentage: number;
  };
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastEntryDate: Date | null;
  milestones: number[];
}

export interface Pattern {
  id: string;
  type: 'time' | 'mood' | 'people' | 'tag' | 'activity';
  description: string;
  significance: 'high' | 'medium' | 'low';
  data: any;
}
