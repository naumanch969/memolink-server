import { CreateMediaRequest, IMedia, UpdateMediaRequest } from "./media.types";

// Media Types

export interface IMediaService {
  createMedia(userId: string, mediaData: CreateMediaRequest): Promise<IMedia>;
  getMediaById(mediaId: string, userId: string): Promise<IMedia>;
  getUserMedia(userId: string, options?: any): Promise<{ media: IMedia[]; total: number; page: number; limit: number; totalPages: number; }>;
  updateMedia(mediaId: string, userId: string, updateData: UpdateMediaRequest): Promise<IMedia>;
  deleteMedia(mediaId: string, userId: string): Promise<void>;
  deleteUserData(userId: string): Promise<number>;
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


