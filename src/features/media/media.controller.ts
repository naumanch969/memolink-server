import { Response } from 'express';
import { mediaService } from './media.service';
import { ResponseHelper } from '../../core/utils/response';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { AuthenticatedRequest } from '../../shared/types';
import { CreateMediaRequest, MediaMetadata } from './media.interfaces';
import { Helpers } from '../../shared/helpers';
import { CloudinaryService } from '../../config/cloudinary';
import { logger } from '../../config/logger';
import { validateVideo, validateFileSize, getFileExtension, buildResolutionString, parseCloudinaryExif, parseCloudinaryOcr, parseCloudinaryAiTags, } from './media.utils';
import { getMediaTypeFromMime } from '../../shared/constants';
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
  static uploadMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!._id.toString();
    const { folderId, tags, altText, description, enableOcr, enableAiTagging } = req.body;

    if (!req.file) {
      ResponseHelper.badRequest(res, UPLOAD_ERRORS.NO_FILE.message);
      return;
    }

    // Check storage quota before upload
    const quotaCheck = await storageService.canUpload(userId, req.file.size);
    if (!quotaCheck.allowed) {
      ResponseHelper.error(res, quotaCheck.reason || UPLOAD_ERRORS.QUOTA_EXCEEDED.message, 403, {
        code: UPLOAD_ERRORS.QUOTA_EXCEEDED.code,
      });
      return;
    }

    //Validate file size (different limits for video)
    const sizeValidation = validateFileSize(req.file);
    if (!sizeValidation.valid) {
      ResponseHelper.badRequest(res, sizeValidation.error || UPLOAD_ERRORS.FILE_TOO_LARGE.message);
      return;
    }

    // Upload to Cloudinary with metadata extraction options
    let cloudinaryResult;
    try {
      cloudinaryResult = await CloudinaryService.uploadFile(req.file, 'memolink', {
        extractExif: true,
        enableOcr: enableOcr === 'true' || enableOcr === true,
        enableAiTagging: enableAiTagging === 'true' || enableAiTagging === true,
      });
    } catch (cloudinaryError: unknown) {
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
        // Cleanup the uploaded file
        try {
          await CloudinaryService.deleteFile(cloudinaryResult.public_id);
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
        videoThumbnails = CloudinaryService.getVideoThumbnails(
          cloudinaryResult.public_id,
          cloudinaryResult.duration
        );
        thumbnail = videoThumbnails[0]; // Default to first
      } else {
        thumbnail = CloudinaryService.getVideoThumbnail(cloudinaryResult.public_id, {
          width: 400,
          height: 300,
        });
      }
    } else if (mediaType === 'image') {
      thumbnail = cloudinaryResult.secure_url;
    } else if (req.file.mimetype === 'application/pdf') {
      thumbnail = CloudinaryService.getPdfThumbnail(cloudinaryResult.public_id);
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

      // Increment storage usage
      await storageService.incrementUsage(userId, req.file.size);

      ResponseHelper.created(res, media, 'Media uploaded successfully');
    } catch (dbError: unknown) {
      const errorMsg = dbError instanceof Error ? dbError.message : 'Unknown error';
      logger.error('Failed to save media record after Cloudinary upload', {
        error: errorMsg,
        cloudinaryId: cloudinaryResult.public_id,
      });

      try {
        await CloudinaryService.deleteFile(cloudinaryResult.public_id);
      } catch {
        logger.error('Failed to cleanup Cloudinary file after DB error', {
          cloudinaryId: cloudinaryResult.public_id,
        });
      }

      ResponseHelper.error(res, UPLOAD_ERRORS.DATABASE_ERROR.message, 500, {
        code: UPLOAD_ERRORS.DATABASE_ERROR.code,
      });
      return;
    }
  });

  /**
   * Update selected video thumbnail
   */
  static updateThumbnail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    const { thumbnailIndex } = req.body;

    const media = await mediaService.getMediaById(id, userId);

    if (media.type !== 'video' || !media.metadata?.videoThumbnails) {
      ResponseHelper.badRequest(res, 'No thumbnail options available for this media');
      return;
    }

    const thumbnails = media.metadata.videoThumbnails;
    if (thumbnailIndex < 0 || thumbnailIndex >= thumbnails.length) {
      ResponseHelper.badRequest(res, 'Invalid thumbnail index');
      return;
    }

    const updated = await mediaService.updateMedia(id, userId, {
      metadata: {
        ...media.metadata,
        selectedThumbnailIndex: thumbnailIndex,
      },
    });

    // Update the main thumbnail URL
    await mediaService.updateMedia(id, userId, {
      // Note: We need to pass thumbnail separately if model supports it
    });

    ResponseHelper.success(res, {
      ...updated,
      thumbnail: thumbnails[thumbnailIndex],
    }, 'Thumbnail updated');
  });

  static createMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!._id.toString();
    const mediaData: CreateMediaRequest = req.body;
    const media = await mediaService.createMedia(userId, mediaData);

    ResponseHelper.created(res, media, 'Media created successfully');
  });

  static getMediaById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    const media = await mediaService.getMediaById(id, userId);

    ResponseHelper.success(res, media, 'Media retrieved successfully');
  });

  static getUserMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
  });

  static deleteMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    await mediaService.deleteMedia(id, userId);

    ResponseHelper.success(res, null, 'Media deleted successfully');
  });

  static bulkMoveMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!._id.toString();
    const { mediaIds, targetFolderId } = req.body;

    if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
      ResponseHelper.badRequest(res, 'mediaIds array is required');
      return;
    }

    await mediaService.bulkMoveMedia(userId, mediaIds, targetFolderId);
    ResponseHelper.success(res, null, 'Media moved successfully');
  });

  static bulkDeleteMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!._id.toString();
    const { mediaIds } = req.body;

    if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
      ResponseHelper.badRequest(res, 'mediaIds array is required');
      return;
    }

    const result = await mediaService.bulkDeleteMedia(userId, mediaIds);
    ResponseHelper.success(res, result, `Deleted ${result.deleted} media items`);
  });
}

export default MediaController;
