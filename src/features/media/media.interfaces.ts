import { Types } from 'mongoose';
import { BaseEntity } from '../../shared/types';

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
      entityId?: Types.ObjectId;
      boundingBox?: { x: number; y: number; width: number; height: number };
      confidence?: number;
    }>;
  };
}

export interface IMediaService {
  createMedia(userId: string, mediaData: CreateMediaRequest): Promise<IMedia>;
  getMediaById(mediaId: string, userId: string): Promise<IMedia>;
  getUserMedia(userId: string, options?: any): Promise<{ media: IMedia[]; total: number; page: number; limit: number; totalPages: number; }>;
  updateMedia(mediaId: string, userId: string, updateData: UpdateMediaRequest): Promise<IMedia>;
  deleteMedia(mediaId: string, userId: string): Promise<void>;
  deleteUserData(userId: string): Promise<number>;
}

export type MediaType = 'image' | 'video' | 'document' | 'audio' | 'archive' | 'data' | 'code';

export interface CreateMediaRequest {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  cloudinaryId: string;
  type: MediaType;
  folderId?: string;
  thumbnail?: string;
  tags?: string[];
  extension?: string;
  altText?: string;
  description?: string;
  metadata?: MediaMetadata;
}

export interface MediaMetadata {
  width?: number;
  height?: number;
  duration?: number;
  pages?: number;
  frameRate?: number;
  bitrate?: number;
  codec?: string;
  resolution?: string;
  videoThumbnails?: string[];
  selectedThumbnailIndex?: number;
  exif?: ExifData;
  ocrText?: string;
  ocrConfidence?: number;
  aiTags?: Array<{ tag: string; confidence: number }>;
}

export interface ExifData {
  make?: string;
  model?: string;
  dateTaken?: string;  // ISO 8601 string for JSON compatibility
  gps?: { latitude?: number; longitude?: number; altitude?: number };
  exposureTime?: string;
  fNumber?: number;
  iso?: number;
  focalLength?: string;
  lens?: string;
  software?: string;
  orientation?: number;
}

export interface UpdateMediaRequest {
  filename?: string;
  originalName?: string;
  folderId?: string;
  thumbnail?: string;
  tags?: string[];
  altText?: string;
  description?: string;
  metadata?: Partial<MediaMetadata>;
}

export interface BulkMoveMediaRequest {
  mediaIds: string[];
  targetFolderId?: string;
}

export interface IChunkedUploadService {
  createSession(request: any): any;
  uploadChunk(request: any): any;
  getSessionStatus(sessionId: string): any;
  completeUpload(sessionId: string): any;
  peekUpload(sessionId: string): any;
  cancelSession(sessionId: string): boolean;
  validateOwnership(sessionId: string, userId: string): boolean;
  getUserSessions(userId: string): any[];
  getStats(): any;
}

export interface IStorageService {
  reserveSpace(userId: string, size: number): Promise<any>;
  getStorageStats(userId: string): Promise<any>;
  getStorageBreakdown(userId: string): Promise<any>;
  canUpload(userId: string, fileSize: number): Promise<{ allowed: boolean; reason?: string }>;
  incrementUsage(userId: string, bytes: number): Promise<void>;
  decrementUsage(userId: string, bytes: number): Promise<void>;
  syncStorageUsage(userId: string): Promise<number>;
  findOrphanedMedia(userId: string): Promise<any[]>;
  getCleanupSuggestions(userId: string): Promise<any[]>;
  formatBytes(bytes: number): string;
}


