import { Types } from "mongoose";
import { BaseEntity } from "../../shared/types";
import { MediaStatus, MediaSource } from "./media.enums";

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
    signedUrl?: string; // Virtual field for signed access
    thumbnail?: string;
    tags?: string[];
    extension?: string;
    altText?: string;
    description?: string;
    status: MediaStatus;
    storageType: 'public' | 'authenticated';
    oldCloudinaryId?: string;
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
    status?: MediaStatus;
    storageType?: 'public' | 'authenticated';
    oldCloudinaryId?: string;
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
    dateTaken?: string;
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

export type MediaType = 'image' | 'video' | 'document' | 'audio' | 'archive' | 'data' | 'code';

export enum MediaJobType {
  PROCESS_AUDIO = 'process_audio',
  PROCESS_IMAGE = 'process_image',
  PROCESS_VIDEO = 'process_video',
  PROCESS_DOCUMENT = 'process_document',
  GENERATE_THUMBNAIL = 'generate_thumbnail',
  RUN_OCR = 'run_ocr',
  AI_TAGGING = 'ai_tagging'
}

export interface MediaJobData {
  userId: string;
  mediaId: string; // Internal media ID
  jobType: MediaJobType;
  sourceType: MediaSource;
  sessionId?: string;
  options?: {
    priority?: number;
    force?: boolean;
    transcode?: boolean; // For audio/video
  };
  whatsappData?: {
    from: string;
    mediaId: string; // WhatsApp Cloud API media ID
    mimeType: string;
  };
}
