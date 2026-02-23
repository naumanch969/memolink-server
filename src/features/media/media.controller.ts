import { Response } from 'express';
import { cloudinaryService } from '../../config/cloudinary';
import { logger } from '../../config/logger';
import { ResponseHelper } from '../../core/utils/response.util';
import { getMediaTypeFromMime } from '../../shared/constants';
import { Helpers } from '../../shared/helpers';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { mediaEvents, MediaEventType } from './media.events';
import { CreateMediaRequest, MediaMetadata } from './media.interfaces';
import { mediaService } from './media.service';
import { buildResolutionString, getFileExtension, parseCloudinaryAiTags, parseCloudinaryExif, parseCloudinaryOcr, validateFileSize, validateVideo, } from './media.utils';
import { storageService } from './storage.service';

// Upload error codes for client-side handling
const UPLOAD_ERRORS = {
  NO_FILE: { code: 'NO_FILE', message: 'No file was uploaded' },
  INVALID_TYPE: { code: 'INVALID_TYPE', message: 'File type is not supported' },
  FILE_TOO_LARGE: { code: 'FILE_TOO_LARGE', message: 'File exceeds maximum size limit' },
  VIDEO_TOO_LONG: { code: 'VIDEO_TOO_LONG', message: 'Video exceeds maximum duration' },
  CLOUDINARY_ERROR: { code: 'CLOUDINARY_ERROR', message: 'Cloud storage upload failed' },
  DATABASE_ERROR: { code: 'DATABASE_ERROR', message: 'Failed to save media record' },
  QUOTA_EXCEEDED: { code: 'QUOTA_EXCEEDED', message: 'Storage quota exceeded' },
} as const;

export class MediaController {
  static async uploadMedia(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { folderId, tags, altText, description, enableOcr, enableAiTagging } = req.body;

      if (!req.file) {
        ResponseHelper.badRequest(res, UPLOAD_ERRORS.NO_FILE.message);
        return;
      }

      // Safely parse boolean flags
      const shouldEnableOcr = enableOcr === 'true' || enableOcr === true || enableOcr === '1';
      const shouldEnableAiTagging = enableAiTagging === 'true' || enableAiTagging === true || enableAiTagging === '1';

      // Reserve storage space atomically (prevents race conditions)
      let reservation;
      try {
        reservation = await storageService.reserveSpace(userId, req.file.size);
      } catch (reservationError: unknown) {
        const errorMsg = reservationError instanceof Error ? reservationError.message : 'Storage reservation failed';
        ResponseHelper.error(res, errorMsg, 403, {
          code: UPLOAD_ERRORS.QUOTA_EXCEEDED.code,
        });
        return;
      }

      //Validate file size (different limits for video)
      const sizeValidation = validateFileSize(req.file);
      if (!sizeValidation.valid) {
        await reservation.rollback();
        ResponseHelper.badRequest(res, sizeValidation.error || UPLOAD_ERRORS.FILE_TOO_LARGE.message);
        return;
      }

      // Upload to Cloudinary with metadata extraction options
      let cloudinaryResult;
      try {
        cloudinaryResult = await cloudinaryService.uploadFile(req.file, 'memolink', {
          extractExif: true,
          enableOcr: shouldEnableOcr,
          enableAiTagging: shouldEnableAiTagging,
        });
      } catch (cloudinaryError: unknown) {
        await reservation.rollback();
        const errorMsg = cloudinaryError instanceof Error ? cloudinaryError.message : 'Unknown error';
        logger.error('Cloudinary upload failed', {
          error: errorMsg,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        });

        let errorMessage: string = UPLOAD_ERRORS.CLOUDINARY_ERROR.message;
        if (errorMsg?.includes('File size too large')) {
          errorMessage = UPLOAD_ERRORS.FILE_TOO_LARGE.message;
        } else if (errorMsg?.includes('Invalid image file')) {
          errorMessage = UPLOAD_ERRORS.INVALID_TYPE.message;
        }

        ResponseHelper.error(res, errorMessage, 500, {
          code: UPLOAD_ERRORS.CLOUDINARY_ERROR.code,
          details: process.env.NODE_ENV === 'development' ? errorMsg : undefined
        });
        return;
      }

      // Determine media type using utility
      const mediaType = getMediaTypeFromMime(req.file.mimetype);

      // Validate video after upload (we now have duration)
      if (mediaType === 'video') {
        const videoValidation = validateVideo(req.file, {
          duration: cloudinaryResult.duration,
          width: cloudinaryResult.width,
          height: cloudinaryResult.height,
        });

        if (!videoValidation.valid) {
          await reservation.rollback();
          // Cleanup the uploaded file
          try {
            await cloudinaryService.deleteFile(cloudinaryResult.public_id);
          } catch {
            // Ignore cleanup errors
          }

          ResponseHelper.badRequest(res, videoValidation.errors.join('. '));
          return;
        }
      }

      // Generate thumbnail URL
      let thumbnail: string | undefined;
      let videoThumbnails: string[] | undefined;

      if (mediaType === 'video' && cloudinaryResult.public_id) {
        // Generate multiple thumbnails for selection
        if (cloudinaryResult.duration) {
          videoThumbnails = cloudinaryService.getVideoThumbnails(
            cloudinaryResult.public_id,
            cloudinaryResult.duration
          );
          thumbnail = videoThumbnails[0]; // Default to first
        } else {
          thumbnail = cloudinaryService.getVideoThumbnail(cloudinaryResult.public_id, {
            width: 400,
            height: 300,
          });
        }
      } else if (mediaType === 'image') {
        thumbnail = cloudinaryResult.secure_url;
      } else if (req.file.mimetype === 'application/pdf') {
        thumbnail = cloudinaryService.getPdfThumbnail(cloudinaryResult.public_id);
      }

      // Build enhanced metadata
      const metadata: MediaMetadata = {
        width: cloudinaryResult.width,
        height: cloudinaryResult.height,
        duration: cloudinaryResult.duration,
        frameRate: cloudinaryResult.frame_rate,
        bitrate: cloudinaryResult.bit_rate,
        codec: cloudinaryResult.codec,
        resolution: buildResolutionString(cloudinaryResult.width, cloudinaryResult.height),
        videoThumbnails,
        selectedThumbnailIndex: 0,
      };

      // Extract EXIF data
      if (cloudinaryResult.image_metadata) {
        const exif = parseCloudinaryExif(cloudinaryResult);
        if (exif) metadata.exif = exif;
      }

      // Extract OCR text
      if (cloudinaryResult.info?.ocr) {
        const { text, confidence } = parseCloudinaryOcr(cloudinaryResult);
        if (text) {
          metadata.ocrText = text;
          metadata.ocrConfidence = confidence;
        }
      }

      // Extract AI tags
      if (cloudinaryResult.info?.categorization) {
        const aiTags = parseCloudinaryAiTags(cloudinaryResult);
        if (aiTags.length > 0) metadata.aiTags = aiTags;
      }

      // Create media record
      try {
        const mediaData: CreateMediaRequest = {
          filename: cloudinaryResult.public_id,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          url: cloudinaryResult.secure_url,
          cloudinaryId: cloudinaryResult.public_id,
          type: mediaType as CreateMediaRequest['type'],
          folderId: folderId || undefined,
          thumbnail,
          tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
          extension: getFileExtension(req.file.originalname, req.file.mimetype),
          altText: altText || undefined,
          description: description || undefined,
          metadata,
        };

        const media = await mediaService.createMedia(userId, mediaData);

        // Commit storage reservation (atomic operation)
        await reservation.commit();

        // Emit upload event
        mediaEvents.emit(MediaEventType.UPLOADED, {
          media,
          userId,
          source: 'web',
        });

        // Emit metadata events if applicable
        if (metadata.exif) {
          mediaEvents.emit(MediaEventType.METADATA_EXTRACTED, {
            mediaId: media._id.toString(),
            userId,
            metadataType: 'exif',
            data: metadata.exif as unknown as Record<string, unknown>,
          });
        }

        if (metadata.ocrText) {
          mediaEvents.emit(MediaEventType.OCR_COMPLETED, {
            mediaId: media._id.toString(),
            userId,
            text: metadata.ocrText,
            confidence: metadata.ocrConfidence || 0,
          });
        }

        if (metadata.aiTags && metadata.aiTags.length > 0) {
          mediaEvents.emit(MediaEventType.AI_TAGGED, {
            mediaId: media._id.toString(),
            userId,
            tags: metadata.aiTags,
          });
        }

        ResponseHelper.created(res, media, 'Media uploaded successfully');
      } catch (dbError: unknown) {
        await reservation.rollback();
        const errorMsg = dbError instanceof Error ? dbError.message : 'Unknown error';
        logger.error('Failed to save media record after Cloudinary upload', {
          error: errorMsg,
          cloudinaryId: cloudinaryResult.public_id,
        });

        try {
          await cloudinaryService.deleteFile(cloudinaryResult.public_id);
        } catch (cleanupError) {
          logger.error('Failed to cleanup Cloudinary file after DB error (orphan created)', {
            cloudinaryId: cloudinaryResult.public_id,
            error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error',
            requiresManualCleanup: true,
          });
        }

        ResponseHelper.error(res, UPLOAD_ERRORS.DATABASE_ERROR.message, 500, {
          code: UPLOAD_ERRORS.DATABASE_ERROR.code,
        });
        return;
      }
    } catch (error) {
      ResponseHelper.error(res, 'Failed to upload media', 500, error);
    }
  }

  static async updateThumbnail(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { id } = req.params;
      const { thumbnailIndex } = req.body;

      // Validate thumbnailIndex is a valid integer
      const index = parseInt(thumbnailIndex, 10);
      if (!Number.isInteger(index) || isNaN(index)) {
        ResponseHelper.badRequest(res, 'Thumbnail index must be a valid integer');
        return;
      }

      const media = await mediaService.getMediaById(id, userId);

      if (media.type !== 'video' || !media.metadata?.videoThumbnails) {
        ResponseHelper.badRequest(res, 'No thumbnail options available for this media');
        return;
      }

      const thumbnails = media.metadata.videoThumbnails;
      if (index < 0 || index >= thumbnails.length) {
        ResponseHelper.badRequest(res, 'Invalid thumbnail index');
        return;
      }

      const selectedThumbnailUrl = thumbnails[index];

      // Update both metadata index and main thumbnail URL in a single operation
      const updated = await mediaService.updateMedia(id, userId, {
        thumbnail: selectedThumbnailUrl,
        metadata: {
          ...media.metadata,
          selectedThumbnailIndex: index,
        },
      });

      ResponseHelper.success(res, updated, 'Thumbnail updated successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to update thumbnail', 500, error);
    }
  }

  static async createMedia(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const mediaData: CreateMediaRequest = req.body;
      const media = await mediaService.createMedia(userId, mediaData);

      ResponseHelper.created(res, media, 'Media created successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to create media', 500, error);
    }
  }

  static async getMediaById(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { id } = req.params;
      const media = await mediaService.getMediaById(id, userId);

      ResponseHelper.success(res, media, 'Media retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve media', 500, error);
    }
  }

  static async getUserMedia(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { page, limit, type, folderId, search } = req.query;
      const { page: pageNum, limit: limitNum } = Helpers.getPaginationParams({ page, limit });

      const options = {
        page: pageNum,
        limit: limitNum,
        type: type as string,
        folderId: folderId as string,
        search: search as string,
      };

      const result = await mediaService.getUserMedia(userId, options);

      ResponseHelper.paginated(res, result.media, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      }, 'Media retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve media', 500, error);
    }
  }

  static async deleteMedia(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { id } = req.params;
      await mediaService.deleteMedia(id, userId);

      ResponseHelper.success(res, null, 'Media deleted successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to delete media', 500, error);
    }
  }

  static async bulkMoveMedia(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { mediaIds, targetFolderId } = req.body;

      if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
        ResponseHelper.badRequest(res, 'mediaIds array is required');
        return;
      }

      await mediaService.bulkMoveMedia(userId, mediaIds, targetFolderId);
      ResponseHelper.success(res, null, 'Media moved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to bulk move media', 500, error);
    }
  }

  static async bulkDeleteMedia(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { mediaIds } = req.body;

      if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
        ResponseHelper.badRequest(res, 'mediaIds array is required');
        return;
      }

      const result = await mediaService.bulkDeleteMedia(userId, mediaIds);
      ResponseHelper.success(res, result, `Deleted ${result.deleted} media items`);
    } catch (error) {
      ResponseHelper.error(res, 'Failed to bulk delete media', 500, error);
    }
  }
}

export default MediaController;
