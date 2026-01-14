import { Response } from 'express';
import { Types } from 'mongoose';
import PDFDocument from 'pdfkit';
import { ExportStrategy } from './export.strategy';
import { ExportRequest } from '../export.interfaces';
import { Entry } from '../../entry/entry.model';
import { Helpers } from '../../../shared/helpers';

export class PdfStrategy implements ExportStrategy {
    async execute(res: Response, userId: string, options: ExportRequest): Promise<void> {
        const userObjectId = new Types.ObjectId(userId);
        const { from, to } = Helpers.getDateRange(options.dateFrom, options.dateTo);

        const filter: any = { userId: userObjectId };
        if (from) filter.createdAt = { ...filter.createdAt, $gte: from };
        if (to) filter.createdAt = { ...filter.createdAt, $lte: to };
        if (!options.includePrivate) filter.isPrivate = false;

        const filename = `memolink-export-${new Date().toISOString().split('T')[0]}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Create a new PDF document
        const doc = new PDFDocument({ margin: 50 });

        // Pipe the PDF into the response
        doc.pipe(res);

        // Filter sensitive data just in case
        // (Though 'includePrivate' flag handles the query filter already)

        // --- Header Page ---
        doc.fontSize(25).text('MemoLink Journal Export', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });

        const dateRangeStr = (options.dateFrom || options.dateTo)
            ? `${options.dateFrom || 'Start'} to ${options.dateTo || 'Present'}`
            : 'All Entries';
        doc.text(`Range: ${dateRangeStr}`, { align: 'center' });
        doc.moveDown(2);
        doc.text('___________________________________________________', { align: 'center' });
        doc.addPage();

        // --- Entries ---
        const cursor = Entry.find(filter)
            .populate(['mentions', 'tags'])
            .sort({ createdAt: -1 }) // Newest first usually for reading, or Oldest first? 
            // Traditionally journals are chronological, but feeds are reverse.
            // Let's stick to reverse chronological as per common export logic so far.
            .cursor();

        let entryCount = 0;

        for (let docEntry = await cursor.next(); docEntry != null; docEntry = await cursor.next()) {
            const entry = docEntry as any;
            entryCount++;

            // Add page break if we are near the bottom
            if (doc.y > 650) {
                doc.addPage();
            }

            // Date Header
            const dateStr = new Date(entry.createdAt).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            doc.font('Helvetica-Bold').fontSize(14).text(dateStr);
            doc.fontSize(10).font('Helvetica').fillColor('grey').text(new Date(entry.createdAt).toLocaleTimeString());
            doc.moveDown(0.5);

            // Content
            doc.font('Helvetica').fontSize(12).text(entry.content, {
                align: 'justify',
                columns: 1
            });
            doc.moveDown(1);

            // Metadata block
            const metadataY = doc.y;
            doc.fontSize(10).fillColor('grey');

            let metaText = '';
            if (entry.mood) metaText += `Mood: ${entry.mood}   `;
            if (entry.location) metaText += `Location: ${entry.location}   `;
            if (entry.type !== 'note') metaText += `Type: ${entry.type}   `;

            if (metaText) {
                doc.text(metaText);
                doc.moveDown(0.2);
            }

            if (entry.mentions?.length) {
                const people = entry.mentions.map((p: any) => p.name).join(', ');
                doc.text(`People: ${people}`);
                doc.moveDown(0.2);
            }

            if (entry.tags?.length) {
                const tags = entry.tags.map((t: any) => t.name).join(', ');
                doc.text(`Tags: ${tags}`);
            }

            // Separator
            doc.moveDown(1);
            doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#e5e7eb').stroke();
            doc.moveDown(2);

            // Reset color
            doc.fillColor('black');
        }

        if (entryCount === 0) {
            doc.text('No entries found for the selected range.');
        }

        // Finalize PDF file
        doc.end();
    }
}
