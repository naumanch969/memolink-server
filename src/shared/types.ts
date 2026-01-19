import { Request } from 'express';
import { Types } from 'mongoose';
import { DataConfig, DataType, DataValue } from './types/dataProperties';

// Re-export global data types
export { DataConfig, DataType, DataValue };

// Base Types
export interface BaseEntity {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  [key: string]: any;
}

// User Types
export interface IUser extends BaseEntity {
  email: string;
  password?: string;
  googleId?: string;
  name: string;
  avatar?: string;
  role: string;
  isEmailVerified: boolean;
  lastLoginAt?: Date;
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    notifications: boolean;
    privacy: 'public' | 'private';
  };
  securityConfig?: {
    question: string;
    answerHash: string; // Hashed answer
    timeoutMinutes: number; // e.g. 5, 15, 30
    isEnabled: boolean;
    maskEntries?: boolean;
  };
  // Storage quota tracking
  storageUsed: number; // bytes
  storageQuota: number; // bytes (default from STORAGE_LIMITS)
}

// OTP Types
export interface IOtp extends BaseEntity {
  email: string;
  otp: string;
  type: 'verification' | 'password_reset';
  expiresAt: Date;
  isUsed: boolean;
  attempts: number;
}

// Entry Types
export interface IEntry extends BaseEntity {
  userId: Types.ObjectId;
  content: string;
  type: 'text' | 'media' | 'mixed';
  mentions: Types.ObjectId[]; // Person IDs
  tags: Types.ObjectId[]; // Tag IDs
  media: Types.ObjectId[]; // Media IDs
  isPrivate: boolean;
  isImportant?: boolean; // Mark special/memorable days
  mood?: string;
  location?: string;
  date: Date;
  startDate?: Date; // For multi-day entries
  endDate?: Date; // For multi-day entries
  startTime?: string; // Format: HH:mm
  endTime?: string; // Format: HH:mm
  isMultiDay?: boolean; // Flag for collective entries
  isEdited?: boolean;
}

// Person Types
export interface IPerson extends BaseEntity {
  userId: Types.ObjectId;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;

  // Professional Details
  jobTitle?: string;
  company?: string;

  // Important Dates
  birthday?: Date;

  // Address
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };

  // Social & Web
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    website?: string;
    facebook?: string;
    instagram?: string;
  };

  // Organization
  tags?: string[];
  role?: string;

  notes?: string;
  isPlaceholder: boolean;
  interactionCount: number;
  lastInteractionAt?: Date;
  lastInteractionSummary?: string;
  sentimentScore?: number;

  // Soft Delete
  isDeleted: boolean;
  deletedAt?: Date;
}

// Relation Types
export interface IRelation extends BaseEntity {
  userId: Types.ObjectId;     // The user who owns this data
  sourceId: Types.ObjectId;   // Person A
  targetId: Types.ObjectId;   // Person B
  type: string;               // "Friend", "Spouse", "Colleague", etc.
  strength?: number;          // 1-10 for visualization weight
}

// Tag Types
export interface ITag extends BaseEntity {
  userId: Types.ObjectId;
  name: string;
  color?: string;
  description?: string;
  usageCount: number;
}

// Media Types
export interface IMedia extends BaseEntity {
  userId: Types.ObjectId;
  folderId?: Types.ObjectId;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  cloudinaryId: string;
  type: 'image' | 'video' | 'document' | 'audio' | 'archive' | 'data' | 'code';
  thumbnail?: string;
  tags?: string[];
  extension?: string;
  altText?: string;
  description?: string;
  status?: 'uploading' | 'processing' | 'ready' | 'error';
  processingError?: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    // Extended metadata
    pages?: number;
    frameRate?: number;
    bitrate?: number;
    codec?: string;
    resolution?: string; // e.g., "1920x1080"
    // Archive metadata
    archiveContents?: Array<{
      name: string;
      size: number;
      isDirectory: boolean;
    }>;
    // Data file metadata
    rowCount?: number;
    columnCount?: number;
    // Code file metadata
    language?: string;
    lineCount?: number;
    videoThumbnails?: string[]; // Multiple thumbnail options
    selectedThumbnailIndex?: number;
    exif?: {
      make?: string; // Camera manufacturer
      model?: string; // Camera model
      dateTaken?: string; // ISO 8601 string for JSON compatibility
      gps?: {
        latitude?: number;
        longitude?: number;
        altitude?: number;
      };
      exposureTime?: string;
      fNumber?: number;
      iso?: number;
      focalLength?: string;
      lens?: string;
      software?: string;
      orientation?: number;
    };
    // OCR extracted text
    ocrText?: string;
    ocrConfidence?: number;
    // AI-generated tags
    aiTags?: Array<{
      tag: string;
      confidence: number;
    }>;
    // Face detection
    faces?: Array<{
      personId?: Types.ObjectId;
      boundingBox?: { x: number; y: number; width: number; height: number };
      confidence?: number;
    }>;
  };
}

// Folder Types
export interface IFolder extends BaseEntity {
  userId: Types.ObjectId;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: Types.ObjectId;
  path: string;
  isDefault: boolean;
  itemCount: number;
}


// Document Types
export interface IDocument extends BaseEntity {
  userId: Types.ObjectId;
  title: string;
  icon?: string;
  coverImage?: string;
  content: any; // JSON for block editor
  isFavorite: boolean;
  isArchived: boolean;
  parentId?: Types.ObjectId | null;
  tags?: string[];
}

export interface CreateDocumentRequest {
  title?: string;
  icon?: string;
  coverImage?: string;
  parentId?: string | null;
  content?: any;
}

export interface UpdateDocumentRequest {
  title?: string;
  icon?: string;
  coverImage?: string;
  content?: any;
  isFavorite?: boolean;
  isArchived?: boolean;
  parentId?: string | null;
  tags?: string[];
}




// Request Types
export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// Pagination Types
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// Search Types
export interface SearchQuery extends PaginationQuery {
  q?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  people?: string[];
  mediaType?: string;
}

// Analytics Types
export interface AnalyticsData {
  totalEntries: number;
  entriesThisMonth: number;
  totalPeople: number;
  totalTags: number;
  totalMedia: number;
  entryFrequency: {
    daily: number[];
    weekly: number[];
    monthly: number[];
  };
  topPeople: Array<{
    person: IPerson;
    interactionCount: number;
  }>;
  topTags: Array<{
    tag: ITag;
    usageCount: number;
  }>;
  mediaStats: {
    totalImages: number;
    totalVideos: number;
    totalDocuments: number;
  };
}



// Export Types
export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf' | 'markdown';
  dateFrom?: Date;
  dateTo?: Date;
  includeMedia?: boolean;
  includePrivate?: boolean;
}

// JWT Payload
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Routine Types
export type RoutineType = DataType;
export type RoutineStatus = 'active' | 'paused' | 'archived';
export type CompletionMode = 'strict' | 'gradual';

// Routine Configuration (type-specific)
export type IRoutineConfig = DataConfig;

// Routine Schedule
export interface IRoutineSchedule {
  activeDays: number[]; // 0-6 (Sunday-Saturday)
}

// Routine Streak Data
export interface IRoutineStreakData {
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  lastCompletedDate?: Date;
}

// Routine Template
export interface IRoutineTemplate extends BaseEntity {
  userId: Types.ObjectId;
  name: string;
  description?: string;
  icon?: string;
  type: RoutineType;
  config: IRoutineConfig;
  schedule: IRoutineSchedule;
  completionMode: CompletionMode;
  gradualThreshold?: number;
  streakData: IRoutineStreakData;
  status: RoutineStatus;
  linkedTags?: Types.ObjectId[];
  order: number;
  archivedAt?: Date;
}

// Routine Log Data (type-specific)
export interface IRoutineLogData {
  value: DataValue;
  // Metadata about the completion ?
  notes?: string;
}

// Routine Log
export interface IRoutineLog extends BaseEntity {
  userId: Types.ObjectId;
  routineId: Types.ObjectId;
  date: Date; // Normalized to start of day
  data: IRoutineLogData;
  completionPercentage: number;
  countsForStreak: boolean;
  journalEntryId?: Types.ObjectId;
  loggedAt: Date;
  configSnapshot?: IRoutineConfig;
}

// User Routine Preferences
export interface IUserRoutinePreferences extends BaseEntity {
  userId: Types.ObjectId;
  reminders: {
    enabled: boolean;
    dailyReminderTime?: string;
    smartReminders: boolean;
    customReminders?: Array<{
      routineId: Types.ObjectId;
      time: string;
      message?: string;
    }>;
  };
  defaultView: 'list' | 'grid' | 'compact';
  showStreaksOnCalendar: boolean;
}

// Routine Statistics
export interface IRoutineStats {
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  recentLogs: IRoutineLog[];
  weeklyTrend: number[];
}

// Overall Routine Analytics
export interface IRoutineAnalytics {
  overallCompletionRate: number;
  totalActiveRoutines: number;
  routineBreakdown: Array<{
    routine: IRoutineTemplate;
    completionRate: number;
    streak: number;
  }>;
}

// Goal Types
export type GoalStatus = 'active' | 'completed' | 'failed' | 'archived';

export type IGoalConfig = DataConfig;

export interface IGoalProgress {
  currentValue?: DataValue;
  notes?: string;
  lastUpdate?: Date;
}

export interface IGoalMilestone {
  _id?: Types.ObjectId;
  title: string;
  targetValue?: number;
  deadline?: Date;
  completed: boolean;
  completedAt?: Date;
}

export interface IGoal extends BaseEntity {
  userId: Types.ObjectId;
  title: string;
  description?: string;
  why?: string; // Motivation
  icon?: string;
  color?: string;

  type: RoutineType; // reusing RoutineType which is now DataType
  status: GoalStatus;

  config: IGoalConfig;
  progress: IGoalProgress;

  startDate: Date;
  deadline?: Date;
  completedAt?: Date;

  linkedRoutines?: Types.ObjectId[]; // Routines that contribute to this goal
  milestones?: IGoalMilestone[];

  priority: 'low' | 'medium' | 'high';
  tags?: Types.ObjectId[];

  reward?: string;
}
