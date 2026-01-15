/**
 * Cloudinary implementation of IMediaStorageProvider
 */

import { v2 as cloudinary } from 'cloudinary';
import { config } from '../../../config/env';
import { logger } from '../../../config/logger';
import {
  IMediaStorageProvider,
  BaseMediaStorageProvider,
  UploadOptions,
  UploadResult,
  ThumbnailOptions,
  TransformOptions,
  VideoThumbnailResult,
  ResourceInfo,
} from './media-storage.interface';

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

export const IMAGE_SIZES = {
  thumbnail: { width: 150, height: 150 },
  small: { width: 320 },
  medium: { width: 640 },
  large: { width: 1024 },
  xlarge: { width: 2048 },
} as const;

const VIDEO_THUMBNAIL_COUNT = 5;

export class CloudinaryStorageProvider extends BaseMediaStorageProvider implements IMediaStorageProvider {
  protected providerName = 'cloudinary';
  private cloudName: string;

  constructor() {
    super();
    this.cloudName = config.CLOUDINARY_CLOUD_NAME;
  }

  isConfigured(): boolean {
    return !!(
      config.CLOUDINARY_CLOUD_NAME &&
      config.CLOUDINARY_API_KEY &&
      config.CLOUDINARY_API_SECRET
    );
  }

  async upload(file: Express.Multer.File, options: UploadOptions = {}): Promise<UploadResult> {
    try {
      const isImage = file.mimetype.startsWith('image/');
      const isVideo = file.mimetype.startsWith('video/');
      const isDocument = file.mimetype === 'application/pdf';

      const uploadOptions: Record<string, unknown> = {
        folder: options.folder || 'memolink',
        resource_type: 'auto' as const,
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
        uploadOptions.auto_tagging = 0.6;
      }

      // Video transcoding
      if (isVideo && options.generateThumbnails !== false) {
        uploadOptions.eager = options.eager || [
          { streaming_profile: 'hd', format: 'm3u8' },
        ];
        uploadOptions.eager_async = true;
      }

      const result = await cloudinary.uploader.upload(
        `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
        uploadOptions
      );

      logger.info('Cloudinary upload successful', {
        publicId: result.public_id,
        format: result.format,
        size: result.bytes,
      });

      // Parse OCR results
      let ocrResult: UploadResult['ocrResult'];
      if (result.info?.ocr?.adv_ocr?.data?.[0]?.textAnnotations?.[0]) {
        const ocr = result.info.ocr.adv_ocr.data[0].textAnnotations[0];
        ocrResult = {
          text: ocr.description || '',
          confidence: ocr.confidence || 0,
        };
      }

      // Parse AI tags
      let aiTags: UploadResult['aiTags'];
      if (result.info?.categorization?.google_tagging?.data) {
        aiTags = result.info.categorization.google_tagging.data.map(
          (t: { tag?: string; confidence?: number }) => ({
            tag: t.tag || '',
            confidence: t.confidence || 0,
          })
        );
      }

      return {
        publicId: result.public_id,
        url: result.url,
        secureUrl: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        duration: result.duration,
        frameRate: result.frame_rate,
        bitRate: result.bit_rate,
        codec: result.video?.codec,
        exifData: result.image_metadata,
        ocrResult,
        aiTags,
      };
    } catch (error) {
      logger.error('Cloudinary upload failed:', error);
      throw error;
    }
  }

  async delete(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
      logger.info('Cloudinary delete successful', { publicId });
    } catch (error) {
      logger.error('Cloudinary delete failed:', error);
      throw error;
    }
  }

  async getResourceInfo(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<ResourceInfo> {
    try {
      const result = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
        image_metadata: true,
        exif: true,
        colors: true,
      });

      return {
        publicId: result.public_id,
        url: result.url,
        secureUrl: result.secure_url,
        format: result.format,
        resourceType: result.resource_type,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        createdAt: result.created_at,
        metadata: result.image_metadata,
      };
    } catch (error) {
      logger.error('Cloudinary getResourceInfo failed:', error);
      throw error;
    }
  }

  getThumbnailUrl(publicId: string, options: ThumbnailOptions = {}): string {
    const {
      width = IMAGE_SIZES.thumbnail.width,
      height = IMAGE_SIZES.thumbnail.height,
      crop = 'fill',
      quality = 'auto',
      format = 'auto',
    } = options;

    const transforms = [
      `w_${width}`,
      `h_${height}`,
      `c_${crop}`,
      `q_${quality}`,
      `f_${format}`,
      'g_auto',
    ];

    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${transforms.join(',')}/${publicId}`;
  }

  getOptimizedUrl(publicId: string, options: TransformOptions = {}): string {
    const {
      width,
      height,
      crop = 'limit',
      quality = 'auto',
      format = 'auto',
    } = options;

    const transforms: string[] = [];
    if (width) transforms.push(`w_${width}`);
    if (height) transforms.push(`h_${height}`);
    transforms.push(`c_${crop}`, `q_${quality}`, `f_${format}`);

    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${transforms.join(',')}/${publicId}`;
  }

  getVideoThumbnails(publicId: string, duration: number, count: number = VIDEO_THUMBNAIL_COUNT): VideoThumbnailResult[] {
    if (duration <= 0) {
      return [{
        url: this.getVideoThumbnailAtTime(publicId, 0),
        timestamp: 0,
      }];
    }

    const thumbnails: VideoThumbnailResult[] = [];
    const interval = duration / (count + 1);

    for (let i = 1; i <= count; i++) {
      const timestamp = Number((interval * i).toFixed(1));
      thumbnails.push({
        url: this.getVideoThumbnailAtTime(publicId, timestamp),
        timestamp,
      });
    }

    return thumbnails;
  }

  private getVideoThumbnailAtTime(publicId: string, time: number, width: number = 400, height: number = 300): string {
    const transforms = [
      `so_${time}`,
      `w_${width}`,
      `h_${height}`,
      'c_fill',
      'f_jpg',
      'q_auto',
    ];

    return `https://res.cloudinary.com/${this.cloudName}/video/upload/${transforms.join(',')}/${publicId}.jpg`;
  }

  getVideoStreamingUrl(publicId: string): string {
    return `https://res.cloudinary.com/${this.cloudName}/video/upload/sp_hd/${publicId}.m3u8`;
  }

  getSignedUrl(publicId: string, expiresInSeconds: number): string {
    const timestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    
    // Generate signed URL using Cloudinary's built-in signing
    const signedUrl = cloudinary.url(publicId, {
      secure: true,
      sign_url: true,
      type: 'authenticated',
      expires_at: timestamp,
    });

    return signedUrl;
  }

  /**
   * Get responsive image variants for srcset
   */
  getResponsiveVariants(publicId: string): {
    thumbnail: string;
    small: string;
    medium: string;
    large: string;
    xlarge: string;
    srcset: string;
  } {
    const thumbnail = this.getThumbnailUrl(publicId);
    const small = this.getOptimizedUrl(publicId, { width: IMAGE_SIZES.small.width });
    const medium = this.getOptimizedUrl(publicId, { width: IMAGE_SIZES.medium.width });
    const large = this.getOptimizedUrl(publicId, { width: IMAGE_SIZES.large.width });
    const xlarge = this.getOptimizedUrl(publicId, { width: IMAGE_SIZES.xlarge.width });

    const srcset = [
      `${small} ${IMAGE_SIZES.small.width}w`,
      `${medium} ${IMAGE_SIZES.medium.width}w`,
      `${large} ${IMAGE_SIZES.large.width}w`,
      `${xlarge} ${IMAGE_SIZES.xlarge.width}w`,
    ].join(', ');

    return { thumbnail, small, medium, large, xlarge, srcset };
  }
}

// Singleton instance
export const cloudinaryStorageProvider = new CloudinaryStorageProvider();
