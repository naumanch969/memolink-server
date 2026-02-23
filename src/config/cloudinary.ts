import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { IMAGE_SIZE_PRESETS, VIDEO_CONFIG } from '../features/media/media.constants';
import { config } from './env';
import { logger } from './logger';

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

export const IMAGE_SIZES = IMAGE_SIZE_PRESETS;

// Video thumbnail presets
const VIDEO_THUMBNAIL_COUNT = VIDEO_CONFIG.THUMBNAIL_COUNT;

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

export interface ICloudinaryService {
  uploadFile(file: any, folder?: string, options?: any): Promise<CloudinaryUploadResult>;
  uploadLargeStream(chunks: Buffer[], mimeType: string, filename: string, folder?: string, options?: any): Promise<CloudinaryUploadResult>;
  deleteFile(publicId: string): Promise<void>;
  getFileInfo(publicId: string): Promise<Record<string, unknown>>;
  getOptimizedUrl(publicId: string, options?: any): string;
  getResponsiveVariants(publicId: string): any;
  getVideoThumbnail(publicId: string, options?: any): string;
  getPdfThumbnail(publicId: string, options?: any): string;
  getVideoThumbnails(publicId: string, duration: number, options?: any): string[];
  getVideoStreamingUrl(publicId: string): string;
  getResourceInfo(publicId: string, resourceType?: 'image' | 'video' | 'raw'): Promise<Record<string, unknown>>;
}

export class CloudinaryService implements ICloudinaryService {

  // Upload file to Cloudinary with enhanced metadata extraction
  async uploadFile(
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

  // Upload file stream to Cloudinary (Better for large files)
  async uploadLargeStream(
    chunks: Buffer[],
    mimeType: string,
    filename: string,
    folder: string = 'memolink',
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
      filename_override: filename,
      use_filename: true,
    };

    if (isImage && options.extractExif !== false) {
      uploadOptions.image_metadata = true;
      uploadOptions.exif = true;
    }

    if ((isImage || isDocument) && options.enableOcr) {
      uploadOptions.ocr = 'adv_ocr';
    }

    if (isVideo) {
      uploadOptions.eager = [{ streaming_profile: 'hd', format: 'm3u8' }];
      uploadOptions.eager_async = true;
      // Use chunk size for Cloudinary's internal chunking if needed
      uploadOptions.chunk_size = 6 * 1024 * 1024;
    }


    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            logger.error('Cloudinary stream upload failed:', error);
            reject(error);
          } else if (result) {
            logger.info('File streamed to Cloudinary successfully', {
              public_id: result.public_id,
              size: result.bytes,
            });
            resolve({
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
            });
          }
        }
      );

      // Convert buffer array into a readable stream and pipe it to Cloudinary
      const readable = Readable.from(chunks);
      readable.pipe(uploadStream);

      readable.on('error', (err: Error) => {
        logger.error('Stream reading error:', err);
        uploadStream.emit('error', err);
      });
    });
  }

  // Delete file from Cloudinary
  async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
      logger.info('File deleted from Cloudinary successfully', { public_id: publicId });
    } catch (error) {
      logger.error('Cloudinary delete failed:', error);
      throw error;
    }
  }

  // Get file info
  async getFileInfo(publicId: string): Promise<Record<string, unknown>> {
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
  getOptimizedUrl(
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
    const { width, height, crop = 'limit', quality = 'auto', format = 'auto', gravity = 'auto', } = options;

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
  getResponsiveVariants(publicId: string): {
    thumbnail: string;
    small: string;
    medium: string;
    large: string;
    xlarge: string;
    srcset: string;
  } {
    const thumbnail = this.getOptimizedUrl(publicId, {
      width: IMAGE_SIZES.THUMBNAIL.width,
      height: IMAGE_SIZES.THUMBNAIL.height,
      crop: 'fill',
    });
    const small = this.getOptimizedUrl(publicId, { width: IMAGE_SIZES.SMALL.width });
    const medium = this.getOptimizedUrl(publicId, { width: IMAGE_SIZES.MEDIUM.width });
    const large = this.getOptimizedUrl(publicId, { width: IMAGE_SIZES.LARGE.width });
    const xlarge = this.getOptimizedUrl(publicId, { width: IMAGE_SIZES.XLARGE.width });

    const srcset = [
      `${small} ${IMAGE_SIZES.SMALL.width}w`,
      `${medium} ${IMAGE_SIZES.MEDIUM.width}w`,
      `${large} ${IMAGE_SIZES.LARGE.width}w`,
      `${xlarge} ${IMAGE_SIZES.XLARGE.width}w`,
    ].join(', ');

    return { thumbnail, small, medium, large, xlarge, srcset };
  }

  /**
   * Generate video thumbnail at specific time
   */
  getVideoThumbnail(
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
  getPdfThumbnail(
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
  getVideoThumbnails(
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
  getVideoStreamingUrl(publicId: string): string {
    const cloudName = config.CLOUDINARY_CLOUD_NAME;
    return `https://res.cloudinary.com/${cloudName}/video/upload/sp_hd/${publicId}.m3u8`;
  }

  /**
   * Get resource with full info (EXIF, OCR, etc.)
   */
  async getResourceInfo(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<Record<string, unknown>> {
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

export const cloudinaryService = new CloudinaryService();
export default cloudinaryService;

