import { Response } from 'express';
import { Types } from 'mongoose';
import { Helpers } from '../../../shared/helpers';
import { Entry } from '../../entry/entry.model';
import { ExportRequest } from '../export.types';
import { ExportStrategy } from './export.strategy';

export class MarkdownStrategy implements ExportStrategy {
    async execute(res: Response, userId: string, options: ExportRequest): Promise<void> {
        const userObjectId = new Types.ObjectId(userId);
        const { from, to } = Helpers.getDateRange(options.dateFrom, options.dateTo);

        const filter: any = { userId: userObjectId };
        if (from) filter.createdAt = { ...filter.createdAt, $gte: from };
        if (to) filter.createdAt = { ...filter.createdAt, $lte: to };
        if (!options.includePrivate) filter.isPrivate = false;

        const filename = `memolink-export-${new Date().toISOString().split('T')[0]}.md`;
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Write Metadata
        res.write(`# MemoLink Export\n\n`);
        res.write(`**Exported:** ${new Date().toISOString()}\n`);
        res.write(`**Date Range:** ${options.dateFrom || 'All time'} - ${options.dateTo || 'Present'}\n\n`);
        res.write(`---\n\n`);

        const cursor = Entry.find(filter)
            .populate(['mentions', 'tags', 'media'])
            .sort({ createdAt: -1 })
            .cursor();

        let count = 0;
        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
            const entry = doc as any;
            count++;

            const dateStr = entry.createdAt ? new Date(entry.createdAt).toISOString().split('T')[0] : 'Unknown Date';
            res.write(`### ${dateStr}\n\n`);
            res.write(`${entry.content}\n\n`);

            const metadata = [];
            if (entry.mood) metadata.push(`**Mood:** ${entry.mood}`);
            if (entry.location) metadata.push(`**Location:** ${entry.location}`);
            if (entry.mentions?.length) metadata.push(`**Entity:** ${entry.mentions.map((p: any) => p.name).join(', ')}`);
            if (entry.tags?.length) metadata.push(`**Tags:** ${entry.tags.map((t: any) => t.name).join(', ')}`);

            if (metadata.length > 0) {
                res.write(metadata.join(' | ') + '\n\n');
            }

            if (entry.media?.length) {
                res.write('**Media:**\n');
                entry.media.forEach((m: any) => {
                    res.write(`- ${m.originalName} (${m.type})\n`);
                });
                res.write('\n');
            }

            res.write(`---\n\n`);
        }

        if (count === 0) {
            res.write('*No entries found for this period.*\n');
        }

        res.end();
    }
}
