import { Response } from 'express';
import { Types } from 'mongoose';
import archiver from 'archiver';
import axios from 'axios';
import cloudinary from '../../../config/cloudinary';
import { ExportStrategy } from './export.strategy';
import { ExportRequest } from '../export.interfaces';
import { Entry } from '../../entry/entry.model';
import { Media } from '../../media/media.model';
import { Person } from '../../person/person.model';
import { Tag } from '../../tag/tag.model';
import { Helpers } from '../../../shared/helpers';

export class ZipStrategy implements ExportStrategy {
    async execute(res: Response, userId: string, options: ExportRequest): Promise<void> {
        const userObjectId = new Types.ObjectId(userId);
        const { from, to } = Helpers.getDateRange(options.dateFrom, options.dateTo);

        const filter: any = { userId: userObjectId };
        if (from) filter.createdAt = { ...filter.createdAt, $gte: from };
        if (to) filter.createdAt = { ...filter.createdAt, $lte: to };
        if (!options.includePrivate) filter.isPrivate = false;

        const filename = `memolink-backup-${new Date().toISOString().split('T')[0]}.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Create zip archive
        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        });

        // Pipe archive data to the response
        archive.pipe(res);

        // 1. Add Data JSON
        const data = await this.getAllData(userObjectId, filter);
        archive.append(JSON.stringify(data, null, 2), { name: 'memolink-data.json' });

        // 2. Add Media Files if requested
        if (options.includeMedia !== false) {
            await this.appendMediaFiles(archive, userObjectId, options);
        }

        // Finalize the archive (ie we are done appending files but streams have to finish yet)
        // 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
        await archive.finalize();
    }

    private async getAllData(userId: Types.ObjectId, filter: any) {
        const [entries, people, tags] = await Promise.all([
            Entry.find(filter).populate(['mentions', 'tags', 'media']).lean(),
            Person.find({ userId }).lean(),
            Tag.find({ userId }).lean(),
        ]);

        return {
            metadata: {
                exportedAt: new Date().toISOString(),
                version: '1.0',
                userId: userId.toString(),
            },
            entries,
            people,
            tags
        };
    }

    private async appendMediaFiles(archive: archiver.Archiver, userId: Types.ObjectId, options: ExportRequest) {
        const { from, to } = Helpers.getDateRange(options.dateFrom, options.dateTo);
        const mediaFilter: any = { userId };
        if (from) mediaFilter.createdAt = { ...mediaFilter.createdAt, $gte: from };
        if (to) mediaFilter.createdAt = { ...mediaFilter.createdAt, $lte: to };

        // Use cursor to avoid loading all media docs
        const cursor = Media.find(mediaFilter).cursor();

        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
            const media = doc as any;
            if (media.cloudinaryId) {
                try {
                    // Determine resource type for Cloudinary
                    let resourceType = 'image';
                    if (media.type === 'video' || media.type === 'audio') resourceType = 'video';
                    else if (media.type === 'document') {
                        resourceType = 'image'; // PDFs are images in Cloudinary usually
                    }

                    // Extract version from original URL if available
                    // URL format: .../image/upload/v123456789/folder/id.ext
                    let version = undefined;
                    if (media.url) {
                        const versionMatch = media.url.match(/\/v(\d+)\//);
                        if (versionMatch && versionMatch[1]) {
                            version = versionMatch[1];
                        }
                    }

                    const extension = media.originalName.split('.').pop();

                    // Generate a signed URL. 
                    const signedUrl = cloudinary.url(media.cloudinaryId, {
                        resource_type: resourceType,
                        // type defaults to 'upload'. If 401 persists, it might be 'authenticated' or 'private'
                        sign_url: true,
                        secure: true,
                        format: extension,
                        version: version // Use exact version
                    });

                    // Fetch file stream
                    const response = await axios({
                        method: 'GET',
                        url: signedUrl,
                        responseType: 'stream'
                    });

                    // Append to zip
                    const safeName = `${media.originalName}`;
                    archive.append(response.data, { name: `media/${safeName}` });
                } catch (error) {
                    // Fallback: If 401/404 on signed URL, and we have original URL, maybe try original?
                    // But original already failed 401 in user logs.
                    // Just log it.
                    console.error(`Failed to download media ${media._id} (${media.originalName}):`, error.message);
                    archive.append(`Failed to download: ${media.originalName}\nError: ${error.message}`, { name: `media/errors/${media._id}.txt` });
                }
            } else if (media.url) {
                // Fallback for non-cloudinary or legacy
                try {
                    const response = await axios({
                        method: 'GET',
                        url: media.url,
                        responseType: 'stream'
                    });
                    const safeName = `${media.originalName}`;
                    archive.append(response.data, { name: `media/${safeName}` });
                } catch (error) {
                    console.error(`Failed to download media ${media._id}:`, error);
                    archive.append(`Failed to download: ${media.url}`, { name: `media/errors/${media._id}.txt` });
                }
            }
        }
    }
}
