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
  getStoragePath(userId: string, type: 'timeline' | 'special', options?: { entryId?: string, assetId?: string, special?: string, assetType?: string }): string;
  getSignedUrl(publicId: string, options?: any): string;
  migrateFile(sourceUrl: string, targetPublicId: string): Promise<any>;
}
