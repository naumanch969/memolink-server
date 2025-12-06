import { IMedia } from '../../shared/types';

export interface IMediaService {
  createMedia(userId: string, mediaData: CreateMediaRequest): Promise<IMedia>;
  getMediaById(mediaId: string, userId: string): Promise<IMedia>;
  getUserMedia(userId: string, options?: any): Promise<{
    media: IMedia[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  updateMedia(mediaId: string, userId: string, updateData: UpdateMediaRequest): Promise<IMedia>;
  deleteMedia(mediaId: string, userId: string): Promise<void>;
}

export interface CreateMediaRequest {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  cloudinaryId: string;
  type: 'image' | 'video' | 'document' | 'audio';
  folderId?: string;
  thumbnail?: string;
  tags?: string[];
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
  };
}

export interface UpdateMediaRequest {
  filename?: string;
  originalName?: string;
  folderId?: string;
  tags?: string[];
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
  };
}

export interface BulkMoveMediaRequest {
  mediaIds: string[];
  targetFolderId?: string;
}
