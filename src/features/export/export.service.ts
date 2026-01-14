import { logger } from '../../config/logger';
import { createError } from '../../core/middleware/errorHandler';
import { ExportRequest, ExportResponse, IExportService } from './export.interfaces';
import { Response } from 'express';
import { ExportStrategy } from './strategies/export.strategy';
import { JsonStrategy } from './strategies/json.strategy';
import { CsvStrategy } from './strategies/csv.strategy';
import { MarkdownStrategy } from './strategies/markdown.strategy';


import { PdfStrategy } from './strategies/pdf.strategy';

export class ExportService implements IExportService {
  private strategies: { [key: string]: ExportStrategy } = {
    json: new JsonStrategy(),
    csv: new CsvStrategy(),
    markdown: new MarkdownStrategy(),

    pdf: new PdfStrategy(),
  };

  async exportData(userId: string, options: ExportRequest, res: Response): Promise<void> {
    try {
      const strategy = this.strategies[options.format];

      if (!strategy) {
        throw createError(`Unsupported export format: ${options.format}`, 400);
      }

      logger.info('Starting export stream', {
        userId,
        format: options.format
      });

      await strategy.execute(res, userId, options);

      logger.info('Export stream completed', {
        userId,
        
        format: options.format
      });

    } catch (error) {
      logger.error('Export failed:', error);
      if (!res.headersSent) {
        throw error;
      } else {
        res.end();
      }
    }
  }
}


export const exportService = new ExportService();

export default ExportService;
