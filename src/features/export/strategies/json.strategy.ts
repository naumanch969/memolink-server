import { Response } from 'express';
import { Types } from 'mongoose';
import { Helpers } from '../../../shared/helpers';
import { KnowledgeEntity } from '../../entity/entity.model';
import { Entry } from '../../entry/entry.model';
import { Media } from '../../media/media.model';
import { Tag } from '../../tag/tag.model';
import { WebActivity } from '../../web-activity/web-activity.model';
import { ExportRequest } from '../export.types';
import { ExportStrategy } from './export.strategy';

export class JsonStrategy implements ExportStrategy {
    async execute(res: Response, userId: string, options: ExportRequest): Promise<void> {
        const userObjectId = new Types.ObjectId(userId);
        const { from, to } = Helpers.getDateRange(options.dateFrom, options.dateTo);

        // Build filter
        const filter: any = { userId: userObjectId };
        if (from) filter.createdAt = { ...filter.createdAt, $gte: from };
        if (to) filter.createdAt = { ...filter.createdAt, $lte: to };
        if (!options.includePrivate) filter.isPrivate = false;

        // Set headers for download
        const filename = `memolink-export-${new Date().toISOString().split('T')[0]}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Start JSON object
        res.write('{\n  "metadata": {\n');
        res.write(`    "exportedAt": "${new Date().toISOString()}",\n`);
        res.write(`    "userId": "${userId}",\n`);
        res.write(`    "dateRange": { "from": "${options.dateFrom || 'null'}", "to": "${options.dateTo || 'null'}" }\n`);
        res.write('  },\n');

        // Stream Entries
        res.write('  "entries": [\n');

        // Use cursor for efficient streaming
        const entryCursor = Entry.find(filter)
            .populate(['mentions', 'tags', 'media'])
            .sort({ createdAt: -1 })
            .cursor();

        let isFirstEntry = true;
        for (let doc = await entryCursor.next(); doc != null; doc = await entryCursor.next()) {
            if (!isFirstEntry) {
                res.write(',\n');
            }
            res.write(JSON.stringify(doc, null, 2).replace(/^/gm, '    ')); // Indent for prettiness
            isFirstEntry = false;
        }
        res.write('\n  ],\n');

        // Stream Entities
        res.write('  "entities": [\n');
        const entityCursor = KnowledgeEntity.find({ userId: userObjectId, isDeleted: false }).cursor();
        let isFirstEntity = true;
        for (let doc = await entityCursor.next(); doc != null; doc = await entityCursor.next()) {
            if (!isFirstEntity) res.write(',\n');
            res.write(JSON.stringify(doc, null, 2).replace(/^/gm, '    '));
            isFirstEntity = false;
        }
        res.write('\n  ],\n');

        // Stream Web Activity
        res.write('  "webActivity": [\n');
        const activityCursor = WebActivity.find({ userId: userObjectId }).cursor();
        let isFirstActivity = true;
        for (let doc = await activityCursor.next(); doc != null; doc = await activityCursor.next()) {
            if (!isFirstActivity) res.write(',\n');
            res.write(JSON.stringify(doc, null, 2).replace(/^/gm, '    '));
            isFirstActivity = false;
        }
        res.write('\n  ],\n');

        // Stream Tags
        res.write('  "tags": [\n');
        const tagsCursor = Tag.find({ userId: userObjectId }).cursor();
        let isFirstTag = true;
        for (let doc = await tagsCursor.next(); doc != null; doc = await tagsCursor.next()) {
            if (!isFirstTag) res.write(',\n');
            res.write(JSON.stringify(doc, null, 2).replace(/^/gm, '    '));
            isFirstTag = false;
        }
        res.write('\n  ]'); // End tags array

        // Optional Media (Metadata only)
        if (options.includeMedia) {
            res.write(',\n  "media": [\n');
            const mediaCursor = Media.find({ userId: userObjectId }).cursor();
            let isFirstMedia = true;
            for (let doc = await mediaCursor.next(); doc != null; doc = await mediaCursor.next()) {
                if (!isFirstMedia) res.write(',\n');
                res.write(JSON.stringify(doc, null, 2).replace(/^/gm, '    '));
                isFirstMedia = false;
            }
            res.write('\n  ]');
        }

        // Close main object
        res.write('\n}');
        res.end();
    }
}
