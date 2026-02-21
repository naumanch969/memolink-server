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
