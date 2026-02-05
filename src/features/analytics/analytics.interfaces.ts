import { IPerson } from '../person/person.interfaces';
import { ITag } from '../tag/tag.interfaces';

// Analytics Types
export interface AnalyticsData {
  totalEntries: number;
  entriesThisMonth: number;
  totalPeople: number;
  totalTags: number;
  totalMedia: number;
  entryFrequency: {
    daily: number[];
    weekly: number[];
    monthly: number[];
  };
  topPeople: Array<{
    person: IPerson;
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
  latestReflection?: any;
  latestWeeklyAnalysis?: any;
}

export interface AnalyticsRequest {
  dateFrom?: string;
  dateTo?: string;
  period?: 'week' | 'month' | 'year';
  [key: string]: any;
}
