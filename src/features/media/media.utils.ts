/**
 * Media Utilities
 * Video validation, EXIF extraction, OCR support
 */

import { logger } from '../../config/logger';
import { FILE_UPLOAD, getMediaTypeFromMime, VIDEO_LIMITS } from '../../shared/constants';
import { AI_PROCESSING_CONFIG, GPS_REFERENCES, VIDEO_CONFIG } from './media.constants';
import { ExifData, MediaType } from './media.types';

/**
 * Video Validation Error
 */
export class VideoValidationError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'VideoValidationError';
    this.code = code;
  }
}

/**
 * Validate video file before upload
 * Video length/size validation
 */
export function validateVideo(
  file: Express.Multer.File,
  metadata?: { duration?: number; width?: number; height?: number }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Size validation (100MB for videos)
  if (file.size > VIDEO_LIMITS.MAX_SIZE) {
    const maxMB = VIDEO_LIMITS.MAX_SIZE / (1024 * 1024);
    errors.push(`Video exceeds maximum size of ${maxMB}MB`);
  }

  // Duration validation (if available from Cloudinary)
  if (metadata?.duration !== undefined) {
    if (metadata.duration > VIDEO_LIMITS.MAX_DURATION) {
      const maxMinutes = VIDEO_LIMITS.MAX_DURATION / 60;
      errors.push(`Video exceeds maximum duration of ${maxMinutes} minutes`);
    }
    if (metadata.duration < VIDEO_LIMITS.MIN_DURATION) {
      errors.push(`Video is too short (minimum ${VIDEO_LIMITS.MIN_DURATION} second)`);
    }
  }

  // Resolution validation
  if (metadata?.width && metadata.width > VIDEO_LIMITS.MAX_RESOLUTION) {
    errors.push(`Video resolution exceeds maximum of ${VIDEO_LIMITS.MAX_RESOLUTION}px width`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate file size based on type
 */
export function validateFileSize(file: Express.Multer.File): { valid: boolean; error?: string } {
  const isVideo = file.mimetype.startsWith('video/');
  const maxSize = isVideo ? FILE_UPLOAD.MAX_VIDEO_SIZE : FILE_UPLOAD.MAX_SIZE;
  
  if (file.size > maxSize) {
    const maxMB = maxSize / (1024 * 1024);
    return {
      valid: false,
      error: `File exceeds maximum size of ${maxMB}MB`,
    };
  }
  
  return { valid: true };
}

/**
 * Generate multiple video thumbnails at different timestamps
 */
export function generateVideoThumbnailTimestamps(duration: number, count: number = 5): number[] {
  if (duration <= 0) return [0];
  
  const timestamps: number[] = [];
  const interval = duration / (count + 1);
  
  for (let i = 1; i <= count; i++) {
    timestamps.push(
      Math.round(interval * i * Math.pow(10, VIDEO_CONFIG.TIMESTAMP_PRECISION_DECIMALS)) / 
      Math.pow(10, VIDEO_CONFIG.TIMESTAMP_PRECISION_DECIMALS)
    );
  }
  
  return timestamps;
}

/**
 * Parse EXIF data from Cloudinary response
 */
export function parseCloudinaryExif(cloudinaryInfo: any): ExifData | undefined {
  if (!cloudinaryInfo?.image_metadata) {
    return undefined;
  }

  const meta = cloudinaryInfo.image_metadata;
  
  // Validate meta is an object
  if (typeof meta !== 'object' || meta === null) {
    logger.warn('Invalid image_metadata format');
    return undefined;
  }
  
  try {
    const exif: ExifData = {};
    
    // Camera info
    if (meta.Make) exif.make = meta.Make;
    if (meta.Model) exif.model = meta.Model;
    
    // Date taken
    if (meta.DateTimeOriginal || meta.CreateDate) {
      const dateStr = meta.DateTimeOriginal || meta.CreateDate;
      exif.dateTaken = parseExifDate(dateStr);
    }
    
    // GPS coordinates
    if (meta.GPSLatitude && meta.GPSLongitude) {
      exif.gps = {
        latitude: parseGpsCoordinate(meta.GPSLatitude, meta.GPSLatitudeRef),
        longitude: parseGpsCoordinate(meta.GPSLongitude, meta.GPSLongitudeRef),
        altitude: meta.GPSAltitude ? parseFloat(meta.GPSAltitude) : undefined,
      };
    }
    
    // Camera settings
    if (meta.ExposureTime) exif.exposureTime = meta.ExposureTime;
    if (meta.FNumber) exif.fNumber = parseFloat(meta.FNumber);
    if (meta.ISO || meta.ISOSpeedRatings) exif.iso = parseInt(meta.ISO || meta.ISOSpeedRatings);
    if (meta.FocalLength) exif.focalLength = meta.FocalLength;
    if (meta.LensModel || meta.LensInfo) exif.lens = meta.LensModel || meta.LensInfo;
    if (meta.Software) exif.software = meta.Software;
    if (meta.Orientation) exif.orientation = parseInt(meta.Orientation);
    
    // Return undefined if no data extracted
    return Object.keys(exif).length > 0 ? exif : undefined;
  } catch (error) {
    logger.warn('Failed to parse EXIF data', { error });
    return undefined;
  }
}

/**
 * Parse EXIF date string to ISO 8601 string
 */
function parseExifDate(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  
  try {
    // EXIF format: "YYYY:MM:DD HH:MM:SS"
    const normalized = dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
    const date = new Date(normalized);
    return isNaN(date.getTime()) ? undefined : date.toISOString();
  } catch {
    return undefined;
  }
}

/**
 * Parse GPS coordinate from EXIF format
 */
function parseGpsCoordinate(value: string, ref?: string): number | undefined {
  if (!value) return undefined;
  
  try {
    // Handle format like "deg 37' 46.50" N" or decimal
    const decimalMatch = value.match(/^[\d.]+$/);
    if (decimalMatch) {
      let coord = parseFloat(value);
      if (ref === GPS_REFERENCES.SOUTH || ref === GPS_REFERENCES.WEST) coord = -coord;
      return coord;
    }
    
    // Parse DMS format
    const dmsMatch = value.match(/(\d+)\s*(?:deg|°)?\s*(\d+)['′]?\s*([\d.]+)["″]?/);
    if (dmsMatch) {
      const deg = parseFloat(dmsMatch[1]);
      const min = parseFloat(dmsMatch[2]);
      const sec = parseFloat(dmsMatch[3]);
      let coord = deg + min / 60 + sec / 3600;
      if (ref === GPS_REFERENCES.SOUTH || ref === GPS_REFERENCES.WEST) coord = -coord;
      return coord;
    }
    
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract OCR text using Cloudinary's OCR addon
 * Returns text content and confidence score
 */
export function parseCloudinaryOcr(cloudinaryInfo: any): { text?: string; confidence?: number } {
  if (!cloudinaryInfo?.info?.ocr?.adv_ocr?.data) {
    return {};
  }

  try {
    const ocrData = cloudinaryInfo.info.ocr.adv_ocr.data;
    
    // Validate ocrData is an array
    if (!Array.isArray(ocrData)) {
      logger.warn('Invalid OCR data format: expected array');
      return {};
    }

    const textBlocks: string[] = [];
    let totalConfidence = 0;
    let blockCount = 0;

    // Parse OCR response structure
    for (const page of ocrData) {
      if (page.textAnnotations) {
        // First annotation is the full text
        if (page.textAnnotations[0]?.description) {
          textBlocks.push(page.textAnnotations[0].description);
        }
      }
      if (page.fullTextAnnotation?.text) {
        textBlocks.push(page.fullTextAnnotation.text);
      }
      // Calculate average confidence
      if (page.fullTextAnnotation?.pages) {
        for (const p of page.fullTextAnnotation.pages) {
          if (p.confidence) {
            totalConfidence += p.confidence;
            blockCount++;
          }
        }
      }
    }

    const text = textBlocks.join('\n').trim();
    const confidence = blockCount > 0 ? totalConfidence / blockCount : undefined;

    return { text: text || undefined, confidence };
  } catch (error) {
    logger.warn('Failed to parse OCR data', { error });
    return {};
  }
}

/**
 * Parse AI auto-tagging from Cloudinary
 */
export function parseCloudinaryAiTags(cloudinaryInfo: any): Array<{ tag: string; confidence: number }> {
  const tags: Array<{ tag: string; confidence: number }> = [];

  try {
    // Parse categorization/tagging results
    const categorization = cloudinaryInfo?.info?.categorization;
    
    if (!categorization || typeof categorization !== 'object') {
      return [];
    }
    
    if (categorization?.google_tagging?.data && Array.isArray(categorization.google_tagging.data)) {
      for (const item of categorization.google_tagging.data) {
        if (item.tag && item.confidence) {
          tags.push({ tag: item.tag, confidence: item.confidence });
        }
      }
    }
    
    if (categorization?.aws_rek_tagging?.data && Array.isArray(categorization.aws_rek_tagging.data)) {
      for (const item of categorization.aws_rek_tagging.data) {
        if (item.tag && item.confidence) {
          tags.push({ tag: item.tag, confidence: item.confidence / 100 }); // AWS uses 0-100
        }
      }
    }

    // Deduplicate and sort by confidence
    const uniqueTags = new Map<string, number>();
    for (const t of tags) {
      const existing = uniqueTags.get(t.tag.toLowerCase());
      if (!existing || existing < t.confidence) {
        uniqueTags.set(t.tag.toLowerCase(), t.confidence);
      }
    }

    return Array.from(uniqueTags.entries())
      .map(([tag, confidence]) => ({ tag, confidence }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, AI_PROCESSING_CONFIG.MAX_AI_TAGS);
  } catch (error) {
    logger.warn('Failed to parse AI tags', { error });
    return [];
  }
}

/**
 * Determine media type from MIME type
 */
export function getMediaType(mimeType: string): MediaType {
  return getMediaTypeFromMime(mimeType) as MediaType;
}

/**
 * Extract file extension from filename or MIME type
 */
export function getFileExtension(filename: string, mimeType?: string): string {
  // Try from filename first
  const fromFilename = filename.split('.').pop()?.toLowerCase();
  if (fromFilename && fromFilename.length <= 5) {
    return fromFilename;
  }
  
  // Fallback to MIME type
  if (mimeType) {
    const parts = mimeType.split('/');
    return parts[parts.length - 1].split('+')[0]; // Handle types like 'image/svg+xml'
  }
  
  return 'bin';
}

/**
 * Build video resolution string
 */
export function buildResolutionString(width?: number, height?: number): string | undefined {
  if (width && height) {
    return `${width}x${height}`;
  }
  return undefined;
}
