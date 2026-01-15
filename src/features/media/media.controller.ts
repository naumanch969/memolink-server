import { Response, NextFunction } from 'express';
import { mediaService } from './media.service';
import { ResponseHelper } from '../../core/utils/response';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { AuthenticatedRequest } from '../../shared/types';
import { CreateMediaRequest } from './media.interfaces';
import { Helpers } from '../../shared/helpers';
import { CloudinaryService } from '../../config/cloudinary';
import { config } from '../../config/env';
import { logger } from '../../config/logger';

// Upload error codes for client-side handling
const UPLOAD_ERRORS = {
  NO_FILE: { code: 'NO_FILE', message: 'No file was uploaded' },
  INVALID_TYPE: { code: 'INVALID_TYPE', message: 'File type is not supported' },
  FILE_TOO_LARGE: { code: 'FILE_TOO_LARGE', message: 'File exceeds maximum size limit' },
  CLOUDINARY_ERROR: { code: 'CLOUDINARY_ERROR', message: 'Cloud storage upload failed' },
  DATABASE_ERROR: { code: 'DATABASE_ERROR', message: 'Failed to save media record' },
} as const;

export class MediaController {
  static uploadMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { folderId, tags } = req.body;

    if (!req.file) {
      ResponseHelper.badRequest(res, UPLOAD_ERRORS.NO_FILE.message);
      return;
    }

    // Upload to Cloudinary with proper error handling
    let cloudinaryResult;
    try {
      cloudinaryResult = await CloudinaryService.uploadFile(req.file, 'memolink');
    } catch (cloudinaryError: unknown) {
      const errorMsg = cloudinaryError instanceof Error ? cloudinaryError.message : 'Unknown error';
      logger.error('Cloudinary upload failed', { 
        error: errorMsg,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      });
      
      // Provide specific error message based on Cloudinary error
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

    // Determine media type
    let mediaType: 'image' | 'video' | 'document' | 'audio' = 'document';
    if (req.file.mimetype.startsWith('image/')) {
      mediaType = 'image';
    } else if (req.file.mimetype.startsWith('video/')) {
      mediaType = 'video';
    } else if (req.file.mimetype.startsWith('audio/')) {
      mediaType = 'audio';
    }

    // Generate thumbnail URL for videos
    let thumbnail: string | undefined;
    if (mediaType === 'video' && cloudinaryResult.public_id) {
      thumbnail = `https://res.cloudinary.com/${config.CLOUDINARY_CLOUD_NAME}/video/upload/so_0,w_400,h_300,c_fill/${cloudinaryResult.public_id}.jpg`;
    } else if (mediaType === 'image') {
      thumbnail = cloudinaryResult.secure_url;
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
        type: mediaType,
        folderId: folderId || undefined,
        thumbnail,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
        metadata: {
          width: cloudinaryResult.width,
          height: cloudinaryResult.height,
          duration: cloudinaryResult.duration,
        },
      };

      const media = await mediaService.createMedia(userId, mediaData);

      ResponseHelper.created(res, media, 'Media uploaded successfully');
    } catch (dbError: unknown) {
      const errorMsg = dbError instanceof Error ? dbError.message : 'Unknown error';
      logger.error('Failed to save media record after Cloudinary upload', {
        error: errorMsg,
        cloudinaryId: cloudinaryResult.public_id,
      });
      
      // Attempt to clean up Cloudinary file since DB save failed
      try {
        await CloudinaryService.deleteFile(cloudinaryResult.public_id);
      } catch (_cleanupError) {
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

  static createMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!._id.toString();
    const mediaData: CreateMediaRequest = req.body;
    const media = await mediaService.createMedia(userId, mediaData);

    ResponseHelper.created(res, media, 'Media created successfully');
  });

  static getMediaById = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    const media = await mediaService.getMediaById(id, userId);

    ResponseHelper.success(res, media, 'Media retrieved successfully');
  });

  static getUserMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
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

  static deleteMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    await mediaService.deleteMedia(id, userId);

    ResponseHelper.success(res, null, 'Media deleted successfully');
  });

  static bulkMoveMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { mediaIds, targetFolderId } = req.body;

    if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
      ResponseHelper.badRequest(res, 'mediaIds array is required');
      return;
    }

    await mediaService.bulkMoveMedia(userId, mediaIds, targetFolderId);
    ResponseHelper.success(res, null, 'Media moved successfully');
  });

  static bulkDeleteMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
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
