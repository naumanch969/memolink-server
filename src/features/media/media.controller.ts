import { Request, Response, NextFunction } from 'express';
import { mediaService } from './media.service';
import { ResponseHelper } from '../../core/utils/response';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { AuthenticatedRequest } from '../../shared/types';
import { CreateMediaRequest } from './media.interfaces';
import { Helpers } from '../../shared/helpers';
import { CloudinaryService } from '../../config/cloudinary';
import { uploadSingle } from '../../core/middleware/uploadMiddleware';

export class MediaController {
  static uploadMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();

    if (!req.file) {
      return ResponseHelper.badRequest(res, 'No file uploaded');
    }

    try {
      // Upload to Cloudinary
      const cloudinaryResult = await CloudinaryService.uploadFile(req.file, 'memolink');

      // Determine media type
      let mediaType: 'image' | 'video' | 'document' | 'audio' = 'document';
      if (req.file.mimetype.startsWith('image/')) {
        mediaType = 'image';
      } else if (req.file.mimetype.startsWith('video/')) {
        mediaType = 'video';
      } else if (req.file.mimetype.startsWith('audio/')) {
        mediaType = 'audio';
      }

      // Create media record
      const mediaData: CreateMediaRequest = {
        filename: cloudinaryResult.public_id,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: cloudinaryResult.secure_url,
        cloudinaryId: cloudinaryResult.public_id,
        type: mediaType,
        metadata: {
          width: cloudinaryResult.width,
          height: cloudinaryResult.height,
          duration: cloudinaryResult.duration,
        },
      };

      const media = await mediaService.createMedia(userId, mediaData);

      ResponseHelper.created(res, media, 'Media uploaded successfully');
    } catch (error) {
      ResponseHelper.error(res, 'File upload failed', 500, error);
    }
  });

  static createMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const mediaData: CreateMediaRequest = req.body;
    const media = await mediaService.createMedia(userId, mediaData);

    ResponseHelper.created(res, media, 'Media created successfully');
  });

  static getMediaById = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    const media = await mediaService.getMediaById(id, userId);

    ResponseHelper.success(res, media, 'Media retrieved successfully');
  });

  static getUserMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { page, limit, type } = req.query;
    const { page: pageNum, limit: limitNum } = Helpers.getPaginationParams({ page, limit });

    const options = {
      page: pageNum,
      limit: limitNum,
      filter: type ? { type } : {},
    };

    const result = await mediaService.getUserMedia(userId, options);

    ResponseHelper.paginated(res, result.media, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    }, 'Media retrieved successfully');
  });

  static deleteMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    await mediaService.deleteMedia(id, userId);

    ResponseHelper.success(res, null, 'Media deleted successfully');
  });
}

export default MediaController;
