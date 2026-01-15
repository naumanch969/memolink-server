/**
 * Media Storage Provider Abstraction
 * 
 * This interface defines the contract for media storage providers.
 * Implementations can be swapped (Cloudinary, AWS S3, local, etc.)
 * without changing the rest of the application.
 */

export interface UploadOptions {
  folder?: string;
  extractExif?: boolean;
  enableOcr?: boolean;
  enableAiTagging?: boolean;
  generateThumbnails?: boolean;
  eager?: string[];
}

export interface UploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  width?: number;
  height?: number;
  duration?: number;
  frameRate?: number;
  bitRate?: number;
  codec?: string;
  exifData?: Record<string, string | number | boolean>;
  ocrResult?: {
    text: string;
    confidence: number;
  };
  aiTags?: Array<{ tag: string; confidence: number }>;
}

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'scale' | 'thumb';
  quality?: number | 'auto';
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
}

export interface TransformOptions {
  width?: number;
  height?: number;
  crop?: string;
  quality?: number | 'auto';
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  effect?: string;
}

export interface VideoThumbnailResult {
  url: string;
  timestamp: number;
}

export interface ResourceInfo {
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  resourceType: string;
  width?: number;
  height?: number;
  bytes: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Abstract interface for media storage providers
 */
export interface IMediaStorageProvider {
  /**
   * Upload a file to storage
   */
  upload(file: Express.Multer.File, options?: UploadOptions): Promise<UploadResult>;

  /**
   * Delete a file from storage
   */
  delete(publicId: string): Promise<void>;

  /**
   * Get information about a stored resource
   */
  getResourceInfo(publicId: string, resourceType?: 'image' | 'video' | 'raw'): Promise<ResourceInfo>;

  /**
   * Generate a thumbnail URL with transformations
   */
  getThumbnailUrl(publicId: string, options?: ThumbnailOptions): string;

  /**
   * Generate an optimized URL with transformations
   */
  getOptimizedUrl(publicId: string, options?: TransformOptions): string;

  /**
   * Generate video thumbnails at different timestamps
   */
  getVideoThumbnails(publicId: string, duration: number, count?: number): VideoThumbnailResult[];

  /**
   * Get streaming URL for video (HLS/DASH)
   */
  getVideoStreamingUrl(publicId: string): string;

  /**
   * Generate a signed URL with expiration
   */
  getSignedUrl(publicId: string, expiresInSeconds: number): string;

  /**
   * Check if provider is available/configured
   */
  isConfigured(): boolean;

  /**
   * Get provider name for logging
   */
  getProviderName(): string;
}

/**
 * Base class with common functionality
 */
export abstract class BaseMediaStorageProvider implements IMediaStorageProvider {
  protected abstract providerName: string;

  abstract upload(file: Express.Multer.File, options?: UploadOptions): Promise<UploadResult>;
  abstract delete(publicId: string): Promise<void>;
  abstract getResourceInfo(publicId: string, resourceType?: 'image' | 'video' | 'raw'): Promise<ResourceInfo>;
  abstract getThumbnailUrl(publicId: string, options?: ThumbnailOptions): string;
  abstract getOptimizedUrl(publicId: string, options?: TransformOptions): string;
  abstract getVideoThumbnails(publicId: string, duration: number, count?: number): VideoThumbnailResult[];
  abstract getVideoStreamingUrl(publicId: string): string;
  abstract getSignedUrl(publicId: string, expiresInSeconds: number): string;
  abstract isConfigured(): boolean;

  getProviderName(): string {
    return this.providerName;
  }
}
