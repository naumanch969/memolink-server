import { Response } from 'express';
import { Types } from 'mongoose';
import { ExportStrategy } from './export.strategy';
import { ExportRequest } from '../export.interfaces';
import { Entry } from '../../entry/entry.model';
import { Helpers } from '../../../shared/helpers';

export class CsvStrategy implements ExportStrategy {
    async execute(res: Response, userId: string, options: ExportRequest): Promise<void> {
        const userObjectId = new Types.ObjectId(userId);
        const { from, to } = Helpers.getDateRange(options.dateFrom, options.dateTo);

        const filter: any = { userId: userObjectId };
        if (from) filter.createdAt = { ...filter.createdAt, $gte: from };
        if (to) filter.createdAt = { ...filter.createdAt, $lte: to };
        if (!options.includePrivate) filter.isPrivate = false;

        const filename = `memolink-export-${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Write BOM for Excel compatibility
        res.write('\uFEFF');

        // Write Headers
        const headers = 'Date,Content,Type,Mood,Location,People,Tags,Media\n';
        res.write(headers);

        const cursor = Entry.find(filter)
            .populate(['mentions', 'tags', 'media'])
            .sort({ createdAt: -1 })
            .cursor();

        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
            const entry = doc as any; // Cast to access populated fields

            const people = entry.mentions?.map((p: any) => p.name).join('; ') || '';
            const tags = entry.tags?.map((t: any) => t.name).join('; ') || '';
            const media = entry.media?.map((m: any) => m.originalName).join('; ') || '';

            // Escape quotes
            const safeContent = (entry.content || '').replace(/"/g, '""');
            const safePeople = people.replace(/"/g, '""');
            const safeTags = tags.replace(/"/g, '""');
            const safeMedia = media.replace(/"/g, '""');
            const safeMood = (entry.mood || '').replace(/"/g, '""');
            const safeLocation = (entry.location || '').replace(/"/g, '""');

            const row = [
                entry.createdAt ? new Date(entry.createdAt).toISOString().split('T')[0] : '',
                `"${safeContent}"`,
                entry.type || '',
                `"${safeMood}"`,
                `"${safeLocation}"`,
                `"${safePeople}"`,
                `"${safeTags}"`,
                `"${safeMedia}"`,
            ].join(',');

            res.write(row + '\n');
        }

        res.end();
    }
}
