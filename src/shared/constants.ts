// API Response Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Database Collection Names
export const COLLECTIONS = {
  USERS: 'users',
  ENTRIES: 'entries',
  PERSONS: 'persons',
  TAGS: 'tags',
  MEDIA: 'media',

  ROUTINE_TEMPLATES: 'routine_templates',
  ROUTINE_LOGS: 'routine_logs',
  ROUTINE_PREFERENCES: 'routine_preferences',
  GOALS: 'goals',
} as const;

// User Roles
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
} as const;

// Entry Types
export const ENTRY_TYPES = {
  TEXT: 'text',
  MEDIA: 'media',
  MIXED: 'mixed',
} as const;

// Media Types
export const MEDIA_TYPES = {
  IMAGE: 'image',
  VIDEO: 'video',
  DOCUMENT: 'document',
  AUDIO: 'audio',
  ARCHIVE: 'archive',
  DATA: 'data',
  CODE: 'code',
} as const;

// Helper to determine media type from MIME type
export const getMediaTypeFromMime = (mimeType: string): string => {
  if (FILE_UPLOAD.ALLOWED_IMAGE_TYPES.includes(mimeType as any)) return MEDIA_TYPES.IMAGE;
  if (FILE_UPLOAD.ALLOWED_VIDEO_TYPES.includes(mimeType as any)) return MEDIA_TYPES.VIDEO;
  if (FILE_UPLOAD.ALLOWED_ARCHIVE_TYPES.includes(mimeType as any)) return MEDIA_TYPES.ARCHIVE;
  if (FILE_UPLOAD.ALLOWED_DATA_TYPES.includes(mimeType as any)) return MEDIA_TYPES.DATA;
  if (FILE_UPLOAD.ALLOWED_CODE_TYPES.includes(mimeType as any)) return MEDIA_TYPES.CODE;
  if (mimeType.startsWith('audio/')) return MEDIA_TYPES.AUDIO;
  return MEDIA_TYPES.DOCUMENT;
};

// Validation Constants
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  EMAIL_MAX_LENGTH: 254,
  NAME_MAX_LENGTH: 100,
  ENTRY_CONTENT_MAX_LENGTH: 1000000,
  TAG_NAME_MAX_LENGTH: 50,
  PERSON_NAME_MAX_LENGTH: 100,
} as const;

// Storage Quota Limits
export const STORAGE_LIMITS = {
  FREE_QUOTA: 500 * 1024 * 1024, // 500MB for free users
  PREMIUM_QUOTA: 5 * 1024 * 1024 * 1024, // 5GB for premium
  WARNING_THRESHOLD: 0.8, // Warn at 80% usage
  CRITICAL_THRESHOLD: 0.95, // Block uploads at 95%
} as const;

// Video Limits
export const VIDEO_LIMITS = {
  MAX_SIZE: 100 * 1024 * 1024, // 100MB for videos
  MAX_DURATION: 600, // 10 minutes in seconds
  MIN_DURATION: 1, // 1 second minimum
  MAX_RESOLUTION: 3840, // 4K max width
  ALLOWED_CODECS: ['h264', 'vp8', 'vp9', 'av1'],
} as const;

// File Upload Constants
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100MB for videos
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/quicktime'],
  ALLOWED_DOCUMENT_TYPES: [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],

  ALLOWED_ARCHIVE_TYPES: [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/gzip',
    'application/x-tar',
  ],
  ALLOWED_DATA_TYPES: [
    'application/json',
    'text/csv',
    'text/xml',
    'application/xml',
  ],
  ALLOWED_CODE_TYPES: [
    'text/markdown',
    'text/x-markdown',
    'text/javascript',
    'application/javascript',
    'text/typescript',
    'text/x-python',
    'text/x-java',
    'text/css',
    'text/html',
    'text/x-yaml',
    'application/x-yaml',
  ],
} as const;

// Pagination Constants
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// Search Constants
export const SEARCH = {
  MIN_QUERY_LENGTH: 2,
  MAX_QUERY_LENGTH: 100,
} as const;

// Routine Types
export const ROUTINE_TYPES = {
  BOOLEAN: 'boolean',
  CHECKLIST: 'checklist',
  COUNTER: 'counter',
  DURATION: 'duration',
  TEXT: 'text',
  SCALE: 'scale',
  TIME: 'time',
} as const;

// Routine Status
export const ROUTINE_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
} as const;

// Goal Status
export const GOAL_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  ARCHIVED: 'archived',
} as const;

// Routine Validation Constants
export const ROUTINE_VALIDATION = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
  CHECKLIST_MAX_ITEMS: 20,
  CHECKLIST_ITEM_MAX_LENGTH: 100,
  COUNTER_MAX_TARGET: 1000000,
  DURATION_MAX_MINUTES: 1440, // 24 hours
  SCALE_MIN: 2,
  SCALE_MAX: 10,
  TEXT_PROMPT_MAX_LENGTH: 200,
  TEXT_RESPONSE_MAX_LENGTH: 1000,
  UNIT_MAX_LENGTH: 20,
  GRADUAL_THRESHOLD_MIN: 1,
  GRADUAL_THRESHOLD_MAX: 100,
  MAX_ACTIVE_DAYS: 7,
} as const;
