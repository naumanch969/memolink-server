import { Request } from 'express';
import { Types } from 'mongoose';

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
}

// User Types
export interface IUser extends BaseEntity {
  email: string;
  password: string;
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

  notes?: string;
  isPlaceholder: boolean;
  interactionCount: number;
  lastInteractionAt?: Date;

  // Soft Delete
  isDeleted: boolean;
  deletedAt?: Date;
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
  type: 'image' | 'video' | 'document' | 'audio';
  thumbnail?: string;
  tags?: string[];
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
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

// Goal Types - Simplified for Weekly Goals
export interface ICheckpoint extends BaseEntity {
  goalId: Types.ObjectId;
  title: string;
  description?: string;
  isCompleted: boolean;
  completedAt?: Date;
  order: number; // For sorting checkpoints within a week
  entries: Types.ObjectId[]; // Entry IDs linked to this checkpoint
}

export interface IGoal extends BaseEntity {
  userId: Types.ObjectId;
  year: number; // e.g., 2025
  weekNumber: number; // 1-52
  weekStartDate: Date; // Monday of the week
  weekEndDate: Date; // Sunday of the week
  checkpoints: Types.ObjectId[]; // References to ICheckpoint
  status: 'active' | 'completed' | 'archived';
  notes?: string; // Overall notes for the week
  currentValue?: number; // Current progress value (for tracking)
  targetValue?: number; // Target value to reach (for tracking)
  linkedTags?: Types.ObjectId[]; // Tags that trigger auto-increment when used in entries
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
export type RoutineType = 'boolean' | 'checklist' | 'counter' | 'duration' | 'text' | 'scale';
export type RoutineStatus = 'active' | 'paused' | 'archived';
export type CompletionMode = 'strict' | 'gradual';

// Routine Configuration (type-specific)
export interface IRoutineConfig {
  // Checklist type
  items?: string[];

  // Counter/Duration type
  target?: number;
  unit?: string;

  // Scale type
  scale?: number;
  scaleLabels?: string[];

  // Text type
  prompt?: string;
}

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
  // Boolean type
  completed?: boolean;

  // Checklist type
  checkedItems?: boolean[];

  // Counter/Duration/Scale type
  value?: number;

  // Text type
  text?: string;
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
