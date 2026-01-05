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
  GOALS: 'goals',
  ROUTINE_TEMPLATES: 'routine_templates',
  ROUTINE_LOGS: 'routine_logs',
  ROUTINE_PREFERENCES: 'routine_preferences',
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
} as const;

// Validation Constants
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  EMAIL_MAX_LENGTH: 254,
  NAME_MAX_LENGTH: 100,
  ENTRY_CONTENT_MAX_LENGTH: 10000,
  TAG_NAME_MAX_LENGTH: 50,
  PERSON_NAME_MAX_LENGTH: 100,
} as const;

// File Upload Constants
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
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
} as const;

// Routine Status
export const ROUTINE_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
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
