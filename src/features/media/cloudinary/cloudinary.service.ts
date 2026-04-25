import { Readable } from 'stream';
import cloudinary from '../../../config/cloudinary.config';
import { config } from '../../../config/env';
import { logger } from '../../../config/logger';
import { IMAGE_SIZE_PRESETS, VIDEO_CONFIG } from '../media.constants';
import { CloudinaryUploadResult, ICloudinaryService } from './cloudinary.types';
import { sanitizePublicId } from '../media.utils';
import { UploadApiResponse, v2 } from 'cloudinary';

export const IMAGE_SIZES = IMAGE_SIZE_PRESETS;

// Video thumbnail presets
const VIDEO_THUMBNAIL_COUNT = VIDEO_CONFIG.THUMBNAIL_COUNT;

export class CloudinaryService implements ICloudinaryService {

  // Upload file to Cloudinary with enhanced metadata extraction
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'brinn',
    options: {
      extractExif?: boolean;
      enableOcr?: boolean;
      enableAiTagging?: boolean;
      public_id?: string;
      overwrite?: boolean;
      invalidate?: boolean;
      [key: string]: any;
    } = {}
  ): Promise<CloudinaryUploadResult> {
    try {
      const isImage = file.mimetype.startsWith('image/');
      const isVideo = file.mimetype.startsWith('video/');
      const isDocument = file.mimetype === 'application/pdf';

      const uploadOptions: Record<string, unknown> = {
        folder,
        resource_type: 'auto' as const,
        type: 'authenticated', // Force authenticated delivery
        public_id: options.public_id || sanitizePublicId(file.originalname),
        ...options,
      };

      // EXIF extraction for images
      if (isImage && options.extractExif !== false) {
        uploadOptions.image_metadata = true;
        uploadOptions.exif = true;
        uploadOptions.colors = true;
      }

      // OCR for documents and images
      if ((isImage || isDocument) && options.enableOcr) {
        uploadOptions.ocr = 'adv_ocr';
      }

      // AI auto-tagging
      if (isImage && options.enableAiTagging) {
        uploadOptions.categorization = 'google_tagging,aws_rek_tagging';
        uploadOptions.auto_tagging = 0.6; // Confidence threshold
      }

      // Video transcoding with eager transformations
      if (isVideo) {
        uploadOptions.eager = [
          // Generate adaptive streaming formats
          { streaming_profile: 'hd', format: 'm3u8' }, // HLS
        ];
        uploadOptions.eager_async = true;
      }

      const result = await cloudinary.uploader.upload(
        `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
        uploadOptions
      );

      logger.info('File uploaded to Cloudinary successfully', {
        public_id: result.public_id,
        format: result.format,
        size: result.bytes,
        hasExif: !!result.image_metadata,
        hasOcr: !!result.info?.ocr,
      });

      return {
        url: result.secure_url,
        public_id: result.public_id,
        secure_url: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        duration: result.duration,
        frame_rate: result.frame_rate,
        bit_rate: result.bit_rate,
        codec: result.video?.codec,
        image_metadata: result.image_metadata,
        info: result.info,
      };
    } catch (error) {
      logger.error('Cloudinary upload failed:', error);
      throw error;
    }
  }

  // Upload file stream to Cloudinary (Better for large files)
  async uploadLargeStream(
    chunks: Buffer[],
    mimeType: string,
    filename: string,
    folder: string = 'brinn',
    options: {
      extractExif?: boolean;
      enableOcr?: boolean;
      enableAiTagging?: boolean;
    } = {}
  ): Promise<CloudinaryUploadResult> {
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    const isDocument = mimeType === 'application/pdf';

    const uploadOptions: Record<string, unknown> = {
      folder,
      resource_type: 'auto' as const,
      type: 'authenticated', // Force authenticated delivery
      public_id: (options as any).public_id || sanitizePublicId(filename),
      ...options,
    };

    if (isImage && options.extractExif !== false) {
      uploadOptions.image_metadata = true;
      uploadOptions.exif = true;
    }

    if ((isImage || isDocument) && options.enableOcr) {
      uploadOptions.ocr = 'adv_ocr';
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            logger.error('Cloudinary stream upload failed:', error);
            return reject(error);
          }
          if (!result) return reject(new Error('No result from Cloudinary'));

          resolve({
            url: result.secure_url,
            public_id: result.public_id,
            secure_url: result.secure_url,
            format: result.format,
            width: result.width,
            height: result.height,
            duration: result.duration,
            image_metadata: result.image_metadata,
            info: result.info,
          });
        }
      );

      const fileStream = new Readable();
      chunks.forEach(chunk => fileStream.push(chunk));
      fileStream.push(null);
      fileStream.pipe(uploadStream);
    });
  }

  async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
      logger.info('Cloudinary file deleted', { publicId });
    } catch (error) {
      logger.error('Failed to delete Cloudinary file:', error);
      throw error;
    }
  }

  async getFileInfo(publicId: string): Promise<Record<string, unknown>> {
    try {
      return await cloudinary.api.resource(publicId);
    } catch (error) {
      logger.error('Failed to get Cloudinary file info:', error);
      throw error;
    }
  }

  async getResourceInfo(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<Record<string, unknown>> {
    try {
      return await cloudinary.api.resource(publicId, { resource_type: resourceType });
    } catch (error) {
      logger.error(`Failed to get Cloudinary resource info for ${publicId}:`, error);
      throw error;
    }
  }

  getOptimizedUrl(publicId: string, options: any = {}): string {
    return cloudinary.url(publicId, {
      fetch_format: 'auto',
      quality: 'auto',
      ...options,
    });
  }

  getResponsiveVariants(publicId: string): any {
    return Object.entries(IMAGE_SIZES).reduce((acc, [key, size]) => {
      const transformOptions: any = {
        width: size.width,
        crop: 'fill',
        gravity: 'auto',
        fetch_format: 'auto',
        quality: 'auto',
      };

      if ('height' in size) {
        transformOptions.height = (size as any).height;
      }

      acc[key] = cloudinary.url(publicId, transformOptions);
      return acc;
    }, {} as Record<string, string>);
  }

  getVideoThumbnail(publicId: string, options: any = {}): string {
    return cloudinary.url(publicId, {
      resource_type: 'video',
      format: 'jpg',
      ...options,
    });
  }

  getPdfThumbnail(publicId: string, options: any = {}): string {
    return cloudinary.url(publicId, {
      resource_type: 'image',
      format: 'jpg',
      page: 1,
      ...options,
    });
  }

  getVideoThumbnails(publicId: string, duration: number, options: any = {}): string[] {
    const thumbnails: string[] = [];
    const interval = duration / (VIDEO_THUMBNAIL_COUNT + 1);

    for (let i = 1; i <= VIDEO_THUMBNAIL_COUNT; i++) {
        thumbnails.push(
            cloudinary.url(publicId, {
                resource_type: 'video',
                format: 'jpg',
                start_offset: i * interval,
                ...options,
            })
        );
    }
    return thumbnails;
  }

  getVideoStreamingUrl(publicId: string): string {
    return cloudinary.url(publicId, {
      resource_type: 'video',
      format: 'm3u8',
      streaming_profile: 'hd',
    });
  }

  getStoragePath(userId: string, type: 'timeline' | 'special', options: { entryId?: string, assetId?: string, special?: string, assetType?: string } = {}): string {
    const env = config.NODE_ENV || 'development';
    const base = `brinn/${env}/users/${userId}`;

    if (type === 'special') {
      return `${base}/${options.special || 'profile'}/${options.assetType || 'avatar'}`;
    }

    // Timeline
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const entryId = options.entryId || 'pending';
    const assetId = options.assetId || Math.random().toString(36).substring(7);

    return `${base}/${year}/${month}/${entryId}_${assetId}`;
  }

  getSignedUrl(publicId: string, options: any = {}): string {
    return cloudinary.url(publicId, {
      sign_url: true,
      type: 'authenticated',
      secure: true,
      expires_at: Math.floor(Date.now() / 1000) + (options.expiresIn || 3600),
      ...options,
    });
  }

  async migrateFile(sourceUrl: string, targetPublicId: string): Promise<UploadApiResponse> {
    try {
      // Try direct URL upload first (efficient)
      const result = await v2.uploader.upload(sourceUrl, {
        public_id: targetPublicId,
        type: 'authenticated',
        resource_type: 'auto',
      });
      return result;
    } catch (error: any) {
      // If it fails with 401/403/400 (could be SSRF protection or restricted access), 
      // try downloading the buffer and uploading that.
      logger.info('URL-based migration failed, attempting buffer-based migration...', { sourceUrl });
      
      try {
        const auth = Buffer.from(`${v2.config().api_key}:${v2.config().api_secret}`).toString('base64');
        const response = await fetch(sourceUrl, {
          headers: {
            'Authorization': `Basic ${auth}`
          }
        });

        if (!response.ok) {
           throw new Error(`Fetch failed with status ${response.status}`);
        }
        
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = response.headers.get('content-type') || 'application/octet-stream';

        const result = await v2.uploader.upload(`data:${mimeType};base64,${base64}`, {
          public_id: targetPublicId,
          type: 'authenticated',
          resource_type: 'auto',
        });
        return result;
      } catch (innerError: any) {
        logger.error('Cloudinary migration copy failed after retry', { 
           sourceUrl, 
           targetPublicId, 
           error: innerError?.message || innerError 
        });
        throw innerError;
      }
    }
  }
}

export const cloudinaryService = new CloudinaryService();
export default cloudinaryService;
