import { IMedia } from '../../shared/types';

export interface IMediaService {
  createMedia(userId: string, mediaData: CreateMediaRequest): Promise<IMedia>;
  getMediaById(mediaId: string, userId: string): Promise<IMedia>;
  getUserMedia(userId: string, options?: any): Promise<{ media: IMedia[]; total: number; page: number; limit: number; totalPages: number; }>;
  updateMedia(mediaId: string, userId: string, updateData: UpdateMediaRequest): Promise<IMedia>;
  deleteMedia(mediaId: string, userId: string): Promise<void>;
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
  dateTaken?: Date;
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
  tags?: string[];
  altText?: string;
  description?: string;
  metadata?: Partial<MediaMetadata>;
}

export interface BulkMoveMediaRequest {
  mediaIds: string[];
  targetFolderId?: string;
}
