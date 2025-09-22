import { logger } from '../../config/logger';
import { createError } from '../../core/middleware/errorHandler';
import { ExportRequest, ExportResponse, IExportService } from './export.interfaces';
import { Entry } from '../entry/entry.model';
import { Person } from '../person/person.model';
import { Tag } from '../tag/tag.model';
import { Media } from '../media/media.model';
import { Habit, HabitLog } from '../habit/habit.model';
import { Types } from 'mongoose';
import { Helpers } from '../../shared/helpers';

export class ExportService implements IExportService {
  async exportData(userId: string, options: ExportRequest): Promise<ExportResponse> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const { from, to } = Helpers.getDateRange(options.dateFrom, options.dateTo);

      // Build filter
      const filter: any = { userId: userObjectId };
      if (from) filter.createdAt = { ...filter.createdAt, $gte: from };
      if (to) filter.createdAt = { ...filter.createdAt, $lte: to };
      if (!options.includePrivate) filter.isPrivate = false;

      // Get data
      const [entries, people, tags, media, habits, habitLogs] = await Promise.all([
        Entry.find(filter).populate(['mentions', 'tags', 'media']).sort({ createdAt: -1 }),
        Person.find({ userId: userObjectId }),
        Tag.find({ userId: userObjectId }),
        options.includeMedia ? Media.find({ userId: userObjectId }) : [],
        Habit.find({ userId: userObjectId }),
        HabitLog.find({ userId: userObjectId }).populate('habitId'),
      ]);

      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          userId,
          totalEntries: entries.length,
          totalPeople: people.length,
          totalTags: tags.length,
          totalMedia: media.length,
          totalHabits: habits.length,
          dateRange: {
            from: options.dateFrom,
            to: options.dateTo,
          },
        },
        entries,
        people,
        tags,
        media,
        habits,
        habitLogs,
      };

      // Generate file based on format
      const result = await this.generateExportFile(exportData, options);

      logger.info('Data exported successfully', {
        userId,
        format: options.format,
        entryCount: entries.length
      });

      return result;
    } catch (error) {
      logger.error('Export failed:', error);
      throw error;
    }
  }

  private async generateExportFile(data: any, options: ExportRequest): Promise<ExportResponse> {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `memolink-export-${timestamp}.${options.format}`;

    switch (options.format) {
      case 'json':
        return this.generateJSONExport(data, filename);
      case 'csv':
        return this.generateCSVExport(data, filename);
      case 'markdown':
        return this.generateMarkdownExport(data, filename);
      case 'pdf':
        return this.generatePDFExport(data, filename);
      default:
        throw createError('Unsupported export format', 400);
    }
  }

  private async generateJSONExport(data: any, filename: string): Promise<ExportResponse> {
    const jsonString = JSON.stringify(data, null, 2);
    const buffer = Buffer.from(jsonString, 'utf8');

    // In a real implementation, you would save this to a file storage service
    // For now, we'll return a placeholder URL
    return {
      downloadUrl: `/api/export/download/${filename}`,
      filename,
      format: 'json',
      size: buffer.length,
    };
  }

  private async generateCSVExport(data: any, filename: string): Promise<ExportResponse> {
    // Convert entries to CSV format
    const csvHeaders = 'Date,Content,Type,Mood,Location,People,Tags,Media\n';
    const csvRows = data.entries.map((entry: any) => {
      const people = entry.mentions?.map((p: any) => p.name).join('; ') || '';
      const tags = entry.tags?.map((t: any) => t.name).join('; ') || '';
      const media = entry.media?.map((m: any) => m.originalName).join('; ') || '';

      return [
        entry.createdAt.toISOString().split('T')[0],
        `"${entry.content.replace(/"/g, '""')}"`,
        entry.type,
        entry.mood || '',
        entry.location || '',
        `"${people}"`,
        `"${tags}"`,
        `"${media}"`,
      ].join(',');
    }).join('\n');

    const csvContent = csvHeaders + csvRows;
    const buffer = Buffer.from(csvContent, 'utf8');

    return {
      downloadUrl: `/api/export/download/${filename}`,
      filename,
      format: 'csv',
      size: buffer.length,
    };
  }

  private async generateMarkdownExport(data: any, filename: string): Promise<ExportResponse> {
    let markdown = `# MemoLink Export\n\n`;
    markdown += `**Exported:** ${data.metadata.exportedAt}\n`;
    markdown += `**Total Entries:** ${data.metadata.totalEntries}\n`;
    markdown += `**Date Range:** ${data.metadata.dateRange.from || 'All time'} - ${data.metadata.dateRange.to || 'Present'}\n\n`;

    // Add entries
    markdown += `## Journal Entries\n\n`;
    data.entries.forEach((entry: any, index: number) => {
      markdown += `### Entry ${index + 1} - ${entry.createdAt.toISOString().split('T')[0]}\n\n`;
      markdown += `${entry.content}\n\n`;

      if (entry.mood) markdown += `**Mood:** ${entry.mood}\n\n`;
      if (entry.location) markdown += `**Location:** ${entry.location}\n\n`;
      if (entry.mentions?.length > 0) {
        markdown += `**People:** ${entry.mentions.map((p: any) => p.name).join(', ')}\n\n`;
      }
      if (entry.tags?.length > 0) {
        markdown += `**Tags:** ${entry.tags.map((t: any) => t.name).join(', ')}\n\n`;
      }
      markdown += `---\n\n`;
    });

    const buffer = Buffer.from(markdown, 'utf8');

    return {
      downloadUrl: `/api/export/download/${filename}`,
      filename,
      format: 'markdown',
      size: buffer.length,
    };
  }

  private async generatePDFExport(data: any, filename: string): Promise<ExportResponse> {
    // TODO: Implement PDF generation using a library like puppeteer or jsPDF
    throw createError('PDF export not implemented yet', 501);
  }
}

export const exportService = new ExportService();

export default ExportService;
