import { Request } from 'express';
import { Types } from 'mongoose';

// Base Types
export interface BaseEntity {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
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
  mood?: string;
  location?: string;
}

// Person Types
export interface IPerson extends BaseEntity {
  userId: Types.ObjectId;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  notes?: string;
  isPlaceholder: boolean;
  interactionCount: number;
  lastInteractionAt?: Date;
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
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  cloudinaryId: string;
  type: 'image' | 'video' | 'document' | 'audio';
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
  };
}

// Habit Types
export interface IHabit extends BaseEntity {
  userId: Types.ObjectId;
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  customDays?: number[]; // For custom frequency (0-6, Sunday-Saturday)
  targetCount?: number; // For habits with specific targets
  unit?: string; // e.g., 'minutes', 'glasses', 'pages'
  status: 'active' | 'paused' | 'completed' | 'archived';
  startDate: Date;
  endDate?: Date;
  color?: string;
  icon?: string;
}

// Habit Log Types
export interface IHabitLog extends BaseEntity {
  habitId: Types.ObjectId;
  userId: Types.ObjectId;
  date: Date;
  completed: boolean;
  count?: number; // For habits with specific counts
  notes?: string;
  mood?: string;
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
  activeHabits: number;
  completedHabitsToday: number;
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
  habitStats: {
    totalHabits: number;
    activeHabits: number;
    completedToday: number;
    longestStreak: number;
    averageCompletion: number;
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
