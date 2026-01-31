export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf' | 'markdown';
  dateFrom?: Date;
  dateTo?: Date;
  includeMedia?: boolean;
  includePrivate?: boolean;
}

export interface IExportService {
  exportData(userId: string, options: ExportRequest, res: any): Promise<void>;
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
