import { v2 as cloudinary } from 'cloudinary';
import { config } from './env';
import { logger } from './logger';

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

// Video thumbnail presets
const VIDEO_THUMBNAIL_COUNT = 5;

export interface CloudinaryUploadResult {
  url: string;
  public_id: string;
  secure_url: string;
  format: string;
  width?: number;
  height?: number;
  duration?: number;
  frame_rate?: number;
  bit_rate?: number;
  codec?: string;
  image_metadata?: Record<string, string | number | boolean>; // EXIF data
  info?: {
    ocr?: { adv_ocr?: { data?: Array<{ textAnnotations?: Array<{ description?: string; confidence?: number }> }> } };
    categorization?: { google_tagging?: { data?: Array<{ tag?: string; confidence?: number }> } };
  };
}

export class CloudinaryService {
  /**
   * Upload file to Cloudinary with enhanced metadata extraction
   */
  static async uploadFile(
    file: Express.Multer.File,
    folder: string = 'memolink',
    options: {
      extractExif?: boolean;
      enableOcr?: boolean;
      enableAiTagging?: boolean;
    } = {}
  ): Promise<CloudinaryUploadResult> {
    try {
      const isImage = file.mimetype.startsWith('image/');
      const isVideo = file.mimetype.startsWith('video/');
      const isDocument = file.mimetype === 'application/pdf';

      const uploadOptions: Record<string, unknown> = {
        folder,
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

  // Delete file from Cloudinary
  static async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
      logger.info('File deleted from Cloudinary successfully', { public_id: publicId });
    } catch (error) {
      logger.error('Cloudinary delete failed:', error);
      throw error;
    }
  }

  // Get file info
  static async getFileInfo(publicId: string): Promise<Record<string, unknown>> {
    try {
      const result = await cloudinary.api.resource(publicId);
      return result;
    } catch (error) {
      logger.error('Get file info failed:', error);
      throw error;
    }
  }

  /**
   * Generate optimized image URL with transformations
   * Uses Cloudinary's on-the-fly transformations for:
   * - Responsive sizing
   * - WebP/AVIF auto-format
   * - Quality optimization
   */
  static getOptimizedUrl(
    publicId: string,
    options: {
      width?: number;
      height?: number;
      crop?: 'fill' | 'fit' | 'scale' | 'thumb' | 'limit';
      quality?: 'auto' | 'auto:low' | 'auto:eco' | 'auto:good' | 'auto:best' | number;
      format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
      gravity?: 'auto' | 'face' | 'center';
    } = {}
  ): string {
    const {
      width,
      height,
      crop = 'limit',
      quality = 'auto',
      format = 'auto',
      gravity = 'auto',
    } = options;

    const transformations: string[] = [];

    if (width) transformations.push(`w_${width}`);
    if (height) transformations.push(`h_${height}`);
    if (crop) transformations.push(`c_${crop}`);
    if (quality) transformations.push(`q_${quality}`);
    if (format) transformations.push(`f_${format}`);
    if (gravity && (crop === 'fill' || crop === 'thumb')) {
      transformations.push(`g_${gravity}`);
    }

    const transformString = transformations.join(',');
    const cloudName = config.CLOUDINARY_CLOUD_NAME;

    return `https://res.cloudinary.com/${cloudName}/image/upload/${transformString}/${publicId}`;
  }

  /**
   * Generate responsive image variants for srcset
   */
  static getResponsiveVariants(publicId: string): {
    thumbnail: string;
    small: string;
    medium: string;
    large: string;
    xlarge: string;
    srcset: string;
  } {
    const thumbnail = this.getOptimizedUrl(publicId, { 
      width: IMAGE_SIZES.thumbnail.width, 
      height: IMAGE_SIZES.thumbnail.height,
      crop: 'fill',
    });
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

  /**
   * Generate video thumbnail at specific time
   */
  static getVideoThumbnail(
    publicId: string, 
    options: { 
      width?: number; 
      height?: number;
      time?: string; // e.g., '2.5' for 2.5 seconds
    } = {}
  ): string {
    const { width = 320, height, time = '0' } = options;
    const cloudName = config.CLOUDINARY_CLOUD_NAME;

    const transforms = [`so_${time}`, `w_${width}`];
    if (height) transforms.push(`h_${height}`);
    transforms.push('c_fill', 'f_jpg', 'q_auto');

    return `https://res.cloudinary.com/${cloudName}/video/upload/${transforms.join(',')}/${publicId}.jpg`;
  }

  /**
   * Generate PDF page thumbnail
   */
  static getPdfThumbnail(
    publicId: string,
    options: {
      page?: number;
      width?: number;
      height?: number;
    } = {}
  ): string {
    const { page = 1, width = 300, height } = options;
    const cloudName = config.CLOUDINARY_CLOUD_NAME;

    const transforms = [`pg_${page}`, `w_${width}`];
    if (height) transforms.push(`h_${height}`);
    transforms.push('c_limit', 'f_jpg', 'q_auto');

    return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms.join(',')}/${publicId}.jpg`;
  }

  /**
   * Generate multiple video thumbnails at different timestamps
   * Returns array of thumbnail URLs for user selection
   */
  static getVideoThumbnails(
    publicId: string,
    duration: number,
    options: {
      count?: number;
      width?: number;
      height?: number;
    } = {}
  ): string[] {
    const { count = VIDEO_THUMBNAIL_COUNT, width = 400, height = 300 } = options;
    
    if (duration <= 0) {
      return [this.getVideoThumbnail(publicId, { width, height, time: '0' })];
    }

    const thumbnails: string[] = [];
    const interval = duration / (count + 1);

    for (let i = 1; i <= count; i++) {
      const time = (interval * i).toFixed(1);
      thumbnails.push(this.getVideoThumbnail(publicId, { width, height, time }));
    }

    return thumbnails;
  }

  /**
   * Get HLS streaming URL for video
   */
  static getVideoStreamingUrl(publicId: string): string {
    const cloudName = config.CLOUDINARY_CLOUD_NAME;
    return `https://res.cloudinary.com/${cloudName}/video/upload/sp_hd/${publicId}.m3u8`;
  }

  /**
   * Get resource with full info (EXIF, OCR, etc.)
   */
  static async getResourceInfo(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<Record<string, unknown>> {
    try {
      const result = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
        image_metadata: true,
        exif: true,
        colors: true,
      });
      return result;
    } catch (error) {
      logger.error('Failed to get resource info:', error);
      throw error;
    }
  }
}

export default cloudinary;
