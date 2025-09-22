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
