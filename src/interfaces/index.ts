// Global Interfaces
import { Request } from 'express';

export interface Person {
  _id: string;
  name: string;
  avatar?: string;
  email?: string;
  phone?: string;
  relationship?: string;
  isActive: boolean;
  tags?: string[];
  notes?: string;
  birthday?: Date;
  lastContact?: Date;
  contactFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'rarely';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Media {
  _id: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  thumbnail?: string;
  publicId: string;
  filename: string;
  mimeType: string;
  size: number;
  duration?: number; // for video/audio
  width?: number; // for image/video
  height?: number; // for image/video
  metadata?: Record<string, any>;
}

export interface Reaction {
  _id: string;
  userId: string;
  type: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry' | 'custom';
  customEmoji?: string;
  createdAt: Date;
}

export interface Mention {
  _id: string;
  personId: string;
  personName: string;
  startIndex: number;
  endIndex: number;
}

export interface Entry {
  _id: string;
  content: string;
  timestamp: Date;
  mood?: string;
  weather?: string;
  location?: string;
  people: Array<{
    _id: string;
    name: string;
    avatar?: string;
  }>;
  mentions: Mention[];
  tags: string[];
  media: Media[];
  reactions: Reaction[];
  isPrivate: boolean;
  isPinned: boolean;
  parentEntryId?: string; // for replies/threads
  replyCount: number;
  viewCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Category {
  _id: string;
  name: string;
  displayName: string;
  color?: string;
  icon?: string;
  description?: string;
  isActive: boolean;
  parentCategoryId?: string;
  sortOrder: number;
  usageCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface User {
  _id: string;
  email: string;
  password: string;
  name?: string;
  avatar?: string;
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
    notifications: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthRequest<P = any, ResBody = any, ReqBody = any, ReqQuery = any> extends Request<P, ResBody, ReqBody, ReqQuery> {
  user?: {
    _id: string;
    email: string;
  };
}

export interface UploadResult {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  duration?: number;
  size: number;
  mimeType: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: PaginationParams;
}

export interface PaginationParams {
  currentPage?: number;
  limit?: number;
  totalPages?: number;
  totalCount?: number;
}

export interface SearchParams {
  query: string;
  filters?: {
    mood?: string;
    weather?: string;
    location?: string;
    people?: string[];
    tags?: string[];
    dateFrom?: Date;
    dateTo?: Date;
    mediaType?: 'image' | 'video' | 'audio' | 'all';
    isPrivate?: boolean;
    isPinned?: boolean;
  };
  sortBy?: 'timestamp' | 'createdAt' | 'relevance' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

export interface EntryStats {
  totalEntries: number;
  totalMedia: number;
  totalPeople: number;
  totalTags: number;
  entriesThisWeek: number;
  entriesThisMonth: number;
  mostActivePeople: Array<{ personId: string; name: string; count: number }>;
  mostUsedTags: Array<{ tag: string; count: number }>;
  moodDistribution: Array<{ mood: string; count: number }>;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'mention' | 'reaction' | 'reply' | 'system';
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
}