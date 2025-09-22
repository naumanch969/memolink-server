import { ExportOptions } from '../../shared/types';

export interface IExportService {
  exportData(userId: string, options: ExportRequest): Promise<ExportResponse>;
}

export interface ExportRequest {
  format: 'json' | 'csv' | 'pdf' | 'markdown';
  dateFrom?: string;
  dateTo?: string;
  includeMedia?: boolean;
  includePrivate?: boolean;
}

export interface ExportResponse {
  downloadUrl: string;
  filename: string;
  format: string;
  size: number;
}
