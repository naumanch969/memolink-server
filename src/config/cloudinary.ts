import { v2 as cloudinary } from 'cloudinary';
import { config } from './env';
import { logger } from './logger';

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

// Phase 5: Image size presets for responsive images
export const IMAGE_SIZES = {
  thumbnail: { width: 150, height: 150 },
  small: { width: 320 },
  medium: { width: 640 },
  large: { width: 1024 },
  xlarge: { width: 2048 },
} as const;

export class CloudinaryService {
  // Upload file to Cloudinary
  static async uploadFile(
    file: Express.Multer.File,
    folder: string = 'memolink',
    options: any = {}
  ): Promise<{
    url: string;
    public_id: string;
    secure_url: string;
    format: string;
    width?: number;
    height?: number;
    duration?: number;
  }> {
    try {
      const uploadOptions = {
        folder,
        resource_type: 'auto' as const,
        ...options,
      };

      const result = await cloudinary.uploader.upload(
        `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
        uploadOptions
      );

      logger.info('File uploaded to Cloudinary successfully', {
        public_id: result.public_id,
        format: result.format,
        size: result.bytes,
      });

      return {
        url: result.secure_url,
        public_id: result.public_id,
        secure_url: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        duration: result.duration,
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
  static async getFileInfo(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.api.resource(publicId);
      return result;
    } catch (error) {
      logger.error('Get file info failed:', error);
      throw error;
    }
  }

  /**
   * Phase 5: Generate optimized image URL with transformations
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
}

export default cloudinary;
