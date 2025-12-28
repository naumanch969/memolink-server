import { Types } from 'mongoose';

// Base DTOs
export interface BaseDto {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Auth DTOs
export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

// User DTOs
export interface UserDto extends BaseDto {
  email: string;
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

export interface UpdateUserDto {
  name?: string;
  avatar?: string;
  preferences?: {
    theme?: 'light' | 'dark' | 'auto';
    notifications?: boolean;
    privacy?: 'public' | 'private';
  };
}

// Entry DTOs
export interface EntryDto extends BaseDto {
  userId: string;
  content: string;
  type: 'text' | 'media' | 'mixed';
  mentions: string[];
  tags: string[];
  media: string[];
  isPrivate: boolean;
  mood?: string;
  location?: string;
}

export interface CreateEntryDto {
  content: string;
  type?: 'text' | 'media' | 'mixed';
  mentions?: string[];
  tags?: string[];
  media?: string[];
  isPrivate?: boolean;
  mood?: string;
  location?: string;
}

export interface UpdateEntryDto {
  content?: string;
  type?: 'text' | 'media' | 'mixed';
  mentions?: string[];
  tags?: string[];
  media?: string[];
  isPrivate?: boolean;
  mood?: string;
  location?: string;
}

// Person DTOs
export interface PersonDto extends BaseDto {
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  notes?: string;
  isPlaceholder: boolean;
  interactionCount: number;
  lastInteractionAt?: Date;
}

export interface CreatePersonDto {
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  notes?: string;
}

export interface UpdatePersonDto {
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  notes?: string;
}

// Tag DTOs
export interface TagDto extends BaseDto {
  userId: string;
  name: string;
  color?: string;
  description?: string;
  usageCount: number;
}

export interface CreateTagDto {
  name: string;
  color?: string;
  description?: string;
}

export interface UpdateTagDto {
  name?: string;
  color?: string;
  description?: string;
}

// Media DTOs
export interface MediaDto extends BaseDto {
  userId: string;
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

export interface CreateMediaDto {
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

// Search and Filter DTOs
export interface SearchDto {
  q?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  people?: string[];
  mediaType?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// Analytics DTOs
export interface AnalyticsDto {
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
    person: PersonDto;
    interactionCount: number;
  }>;
  topTags: Array<{
    tag: TagDto;
    usageCount: number;
  }>;
  mediaStats: {
    totalImages: number;
    totalVideos: number;
    totalDocuments: number;
  };
}

// Export DTOs
export interface ExportDto {
  format: 'json' | 'csv' | 'pdf' | 'markdown';
  dateFrom?: Date;
  dateTo?: Date;
  includeMedia?: boolean;
  includePrivate?: boolean;
}
