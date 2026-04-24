import { Response } from 'express';
import cloudinaryService from '../../config/cloudinary.service';
import { logger } from '../../config/logger';
import { ResponseHelper } from '../../core/utils/response.utils';
import { getMediaTypeFromMime } from '../../shared/constants';
import { AuthenticatedRequest } from '../auth/auth.types';
import { mediaService } from '../media/media.service';
import { getFileExtension } from '../media/media.utils';
import { storageService } from '../media/storage/storage.service';
import { captureService } from './capture.service';

export class CaptureController {
    constructor() {
        this.captureEntry = this.captureEntry.bind(this);
        this.captureWeb = this.captureWeb.bind(this);
        this.captureWhatsApp = this.captureWhatsApp.bind(this);
    }

    /**
     * Upload a single Express.Multer.File to Cloudinary and persist a Media record.
     * Returns the new Media document's string ID.
     */
    private async uploadFile(userId: string, file: Express.Multer.File): Promise<string> {
        const cloudinaryResult = await cloudinaryService.uploadFile(file, 'brinn', {
            extractExif: true,
            enableOcr: false,
            enableAiTagging: false,
        });
        const mediaType = getMediaTypeFromMime(file.mimetype);
        const media = await mediaService.createMedia(userId, {
            filename: cloudinaryResult.public_id,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            url: cloudinaryResult.secure_url,
            cloudinaryId: cloudinaryResult.public_id,
            type: mediaType as any,
            extension: getFileExtension(file.originalname, file.mimetype),
            metadata: {
                width: cloudinaryResult.width,
                height: cloudinaryResult.height,
                duration: cloudinaryResult.duration,
            },
        });
        return (media._id as any).toString();
    }

    // 1. ACTIVE: Text/Voice/Manual Entry
    async captureEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
        const userId = req.user?._id?.toString();

        try {
            const mediaIds: string[] = [];
            const uploadedFiles = req.files as Record<string, Express.Multer.File[]> | undefined;

            if (uploadedFiles && Object.keys(uploadedFiles).length > 0) {
                // Reserve storage for all files before uploading
                const allFiles = Object.values(uploadedFiles).flat();
                const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0);

                const reservation = await storageService.reserveSpace(userId!, totalSize);
                try {
                    for (const file of allFiles) {
                        const mediaId = await this.uploadFile(userId!, file);
                        mediaIds.push(mediaId);
                    }
                    await reservation.commit();
                } catch (uploadError) {
                    await reservation.rollback();
                    throw uploadError;
                }
            }

            const payload = {
                ...req.body,
                ...(mediaIds.length > 0 ? { media: mediaIds } : {}),
            };

            const entry = await captureService.captureEntry(userId!, payload);
            logger.info(`CaptureController: Entry captured with ${mediaIds.length} media file(s) [User: ${userId}]`);
            ResponseHelper.success(res, { status: 'queued', source: 'active-entry', entry });
        } catch (error: any) {
            ResponseHelper.error(res, error.message);
        }
    }

    // 2. PASSIVE: Web Activity Sync (Browser Extension)
    async captureWeb(req: AuthenticatedRequest, res: Response): Promise<void> {
        const userId = req.user?._id?.toString();

        try {
            await captureService.captureWeb(userId, req.body);
            ResponseHelper.success(res, { status: 'queued', source: 'web-extension' });
        } catch (error: any) {
            ResponseHelper.error(res, error.message);
        }
    }

    // 3. SOCIAL/WEBHOOK: WhatsApp Bot
    async captureWhatsApp(req: AuthenticatedRequest, res: Response): Promise<void> {
        const userId = req.user?._id?.toString();

        try {
            await captureService.captureWhatsApp(userId, req.body);
            ResponseHelper.success(res, { status: 'queued', source: 'whatsapp' });
        } catch (error: any) {
            ResponseHelper.error(res, error.message);
        }
    }
}

export const captureController = new CaptureController();
