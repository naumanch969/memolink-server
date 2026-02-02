import { Response } from 'express';
import { CloudinaryService } from '../../config/cloudinary';
import { logger } from '../../config/logger';
import { ResponseHelper } from '../../core/utils/response';
import { getMediaTypeFromMime } from '../../shared/constants';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { chunkedUploadService } from './chunked-upload.service';
import { mediaEvents, MediaEventType } from './media.events';
import { CreateMediaRequest, MediaMetadata } from './media.interfaces';
import { mediaService } from './media.service';
import { buildResolutionString, getFileExtension, parseCloudinaryAiTags, parseCloudinaryExif, parseCloudinaryOcr } from './media.utils';
import { storageService } from './storage.service';

export class ChunkedUploadController {
  /**
   * Initialize a chunked upload session
   */
  static async initSession(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { fileName, mimeType, totalSize, chunkSize, metadata } = req.body;

      // Validate required fields
      if (!fileName || !mimeType || !totalSize) {
        ResponseHelper.badRequest(res, 'fileName, mimeType, and totalSize are required');
        return;
      }

      // Check storage quota
      const quotaCheck = await storageService.canUpload(userId, totalSize);
      if (!quotaCheck.allowed) {
        ResponseHelper.error(res, quotaCheck.reason || 'Storage quota exceeded', 403, {
          code: 'QUOTA_EXCEEDED',
        });
        return;
      }

      const session = chunkedUploadService.createSession({
        userId,
        fileName,
        mimeType,
        totalSize,
        chunkSize,
        metadata,
      });

      ResponseHelper.created(res, session, 'Upload session created');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to create session';
      logger.error('Failed to create chunked upload session', { error: msg, userId: req.user?._id });
      ResponseHelper.error(res, msg, 500);
    }
  }

  /**
   * Upload a chunk
   */
  static async uploadChunk(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { sessionId } = req.params;
      const chunkIndex = parseInt(req.query.chunkIndex as string, 10);
      const checksum = req.query.checksum as string;

      // Validate session ownership
      if (!chunkedUploadService.validateOwnership(sessionId, userId)) {
        ResponseHelper.error(res, 'Upload session not found', 404);
        return;
      }

      // Validate chunk index
      if (isNaN(chunkIndex) || chunkIndex < 0) {
        ResponseHelper.badRequest(res, 'Valid chunkIndex is required');
        return;
      }

      // Get raw body as Buffer
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const data = Buffer.concat(chunks);

      const result = chunkedUploadService.uploadChunk({
        sessionId,
        chunkIndex,
        data,
        checksum,
      });

      ResponseHelper.success(res, result, 'Chunk uploaded');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to upload chunk';
      logger.error('Failed to upload chunk', { error: msg, sessionId: req.params.sessionId, chunkIndex: req.query.chunkIndex });
      ResponseHelper.error(res, msg, 400);
    }
  }

  /**
   * Get session status
   */
  static async getSessionStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { sessionId } = req.params;

      // Validate session ownership
      if (!chunkedUploadService.validateOwnership(sessionId, userId)) {
        ResponseHelper.error(res, 'Upload session not found', 404);
        return;
      }

      const status = chunkedUploadService.getSessionStatus(sessionId);
      if (!status) {
        ResponseHelper.error(res, 'Upload session not found', 404);
        return;
      }

      ResponseHelper.success(res, status, 'Session status retrieved');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieval session status', 500, error);
    }
  }

  /**
   * Complete chunked upload and create media record
   */
  static async completeUpload(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { sessionId } = req.params;
      const { folderId, tags, altText, description, enableOcr, enableAiTagging } = req.body;

      // Validate session ownership
      if (!chunkedUploadService.validateOwnership(sessionId, userId)) {
        ResponseHelper.error(res, 'Upload session not found', 404);
        return;
      }

      // Assemble the file (peek first, don't delete yet)
      const { chunks, session } = chunkedUploadService.peekUpload(sessionId);

      // Upload to Cloudinary via stream
      const cloudinaryResult = await CloudinaryService.uploadLargeStream(
        chunks,
        session.mimeType,
        session.fileName,
        'memolink',
        {
          extractExif: true,
          enableOcr: enableOcr === 'true' || enableOcr === true,
          enableAiTagging: enableAiTagging === 'true' || enableAiTagging === true,
        }
      );

      const mediaType = getMediaTypeFromMime(session.mimeType);

      // Generate thumbnail
      let thumbnail: string | undefined;
      let videoThumbnails: string[] | undefined;

      if (mediaType === 'video' && cloudinaryResult.public_id) {
        if (cloudinaryResult.duration) {
          videoThumbnails = CloudinaryService.getVideoThumbnails(
            cloudinaryResult.public_id,
            cloudinaryResult.duration
          );
          thumbnail = videoThumbnails[0];
        } else {
          thumbnail = CloudinaryService.getVideoThumbnail(cloudinaryResult.public_id, {
            width: 400,
            height: 300,
          });
        }
      } else if (mediaType === 'image') {
        thumbnail = cloudinaryResult.secure_url;
      } else if (session.mimeType === 'application/pdf') {
        thumbnail = CloudinaryService.getPdfThumbnail(cloudinaryResult.public_id);
      }

      // Build metadata
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

      if (cloudinaryResult.image_metadata) {
        const exif = parseCloudinaryExif(cloudinaryResult);
        if (exif) metadata.exif = exif;
      }

      if (cloudinaryResult.info?.ocr) {
        const { text, confidence } = parseCloudinaryOcr(cloudinaryResult);
        if (text) {
          metadata.ocrText = text;
          metadata.ocrConfidence = confidence;
        }
      }

      if (cloudinaryResult.info?.categorization) {
        const aiTags = parseCloudinaryAiTags(cloudinaryResult);
        if (aiTags.length > 0) metadata.aiTags = aiTags;
      }

      // Create media record
      const mediaData: CreateMediaRequest = {
        filename: cloudinaryResult.public_id,
        originalName: session.fileName,
        mimeType: session.mimeType,
        size: session.totalSize,
        url: cloudinaryResult.secure_url,
        cloudinaryId: cloudinaryResult.public_id,
        type: mediaType as CreateMediaRequest['type'],
        folderId: folderId || undefined,
        thumbnail,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
        extension: getFileExtension(session.fileName, session.mimeType),
        altText: altText || undefined,
        description: description || undefined,
        metadata,
      };

      const media = await mediaService.createMedia(userId, mediaData);

      // Increment storage usage
      await storageService.incrementUsage(userId, session.totalSize);

      // Emit upload event
      mediaEvents.emit(MediaEventType.UPLOADED, {
        media,
        userId,
        source: 'web',
      });

      // Clean up session after full success
      chunkedUploadService.cancelSession(sessionId);

      ResponseHelper.created(res, media, 'Chunked upload completed');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to complete upload';
      logger.error('Failed to complete chunked upload', { error: msg, sessionId: req.params.sessionId });
      ResponseHelper.error(res, msg, 500);
    }
  }

  /**
   * Cancel upload session
   */
  static async cancelSession(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { sessionId } = req.params;

      // Validate session ownership
      if (!chunkedUploadService.validateOwnership(sessionId, userId)) {
        ResponseHelper.error(res, 'Upload session not found', 404);
        return;
      }

      chunkedUploadService.cancelSession(sessionId);
      ResponseHelper.success(res, null, 'Upload session cancelled');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to cancel session', 500, error);
    }
  }

  /**
   * Get user's active upload sessions
   */
  static async getUserSessions(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const sessions = chunkedUploadService.getUserSessions(userId);
      ResponseHelper.success(res, sessions, 'Sessions retrieved');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve sessions', 500, error);
    }
  }
}
