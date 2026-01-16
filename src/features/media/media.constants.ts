/**
 * Media Module Constants
 * 
 * Centralized configuration values for the media module.
 * Extracted from magic numbers throughout the codebase for better maintainability.
 */

// Storage Quota Thresholds
export const STORAGE_THRESHOLDS = {
  WARNING_PERCENT: 0.8,     // Warn users at 80% usage
  CRITICAL_PERCENT: 0.95,   // Block uploads at 95% usage
} as const;

// Video Processing
export const VIDEO_CONFIG = {
  THUMBNAIL_COUNT: 5,                    // Number of thumbnails to generate for selection
  TIMESTAMP_PRECISION_DECIMALS: 1,       // Decimal places for timestamp precision
  DEFAULT_THUMBNAIL_WIDTH: 400,
  DEFAULT_THUMBNAIL_HEIGHT: 300,
} as const;

// Upload Queue Configuration
export const UPLOAD_QUEUE_CONFIG = {
  MAX_CONCURRENT_UPLOADS: 3,             // Maximum parallel uploads
  MAX_RETRY_ATTEMPTS: 3,                 // Retry failed uploads this many times
  RETRY_DELAY_BASE_MS: 2000,             // Base delay between retries (multiplied by attempt number)
  MAX_LISTENERS: 100,                    // Maximum event listeners to prevent memory leaks
  AUTO_CLEAR_COMPLETED_MS: 5 * 60 * 1000, // Clear completed items after 5 minutes
} as const;

// Chunked Upload Configuration
export const CHUNKED_UPLOAD_CONFIG = {
  DEFAULT_CHUNK_SIZE: 5 * 1024 * 1024,   // 5MB default chunk size
  MAX_CHUNK_SIZE: 20 * 1024 * 1024,      // 20MB maximum chunk size
  MIN_CHUNK_SIZE: 1 * 1024 * 1024,       // 1MB minimum chunk size
  SESSION_TIMEOUT_MS: 24 * 60 * 60 * 1000, // 24 hours
  CLEANUP_INTERVAL_MS: 60 * 60 * 1000,   // 1 hour cleanup interval
} as const;

// AI & Processing Limits
export const AI_PROCESSING_CONFIG = {
  MAX_AI_TAGS: 20,                       // Maximum number of AI-generated tags to keep
  MIN_AI_TAG_CONFIDENCE: 0.6,            // Minimum confidence threshold for AI tags
  MAX_OCR_TEXT_LENGTH: 100000,           // Maximum OCR text to store (characters)
} as const;

// GPS Coordinate References
export const GPS_REFERENCES = {
  SOUTH: 'S',
  NORTH: 'N',
  WEST: 'W',
  EAST: 'E',
} as const;

// Image Size Presets (for responsive images)
export const IMAGE_SIZE_PRESETS = {
  THUMBNAIL: { width: 150, height: 150 },
  SMALL: { width: 320 },
  MEDIUM: { width: 640 },
  LARGE: { width: 1024 },
  XLARGE: { width: 2048 },
} as const;

// Media Processing Job Types
export const MEDIA_JOB_TYPES = {
  THUMBNAIL: 'thumbnail',
  TRANSCODE: 'transcode',
  METADATA: 'metadata',
  OCR: 'ocr',
  AI_TAG: 'ai-tag',
} as const;

// Cleanup & Maintenance
export const CLEANUP_CONFIG = {
  ORPHAN_CHECK_INTERVAL_DAYS: 7,         // Check for orphaned files weekly
  ORPHAN_AGE_THRESHOLD_DAYS: 30,         // Delete orphans older than 30 days
  FAILED_UPLOAD_RETENTION_DAYS: 7,       // Keep failed upload records for 7 days
} as const;

export default {
  STORAGE_THRESHOLDS,
  VIDEO_CONFIG,
  UPLOAD_QUEUE_CONFIG,
  CHUNKED_UPLOAD_CONFIG,
  AI_PROCESSING_CONFIG,
  GPS_REFERENCES,
  IMAGE_SIZE_PRESETS,
  MEDIA_JOB_TYPES,
  CLEANUP_CONFIG,
};
