/**
 * Chunked Upload Service
 * 
 * Enables resumable uploads for large files by splitting them into chunks.
 * Provides:
 * - Session management for tracking upload progress
 * - Chunk verification and ordering
 * - Resume capability after interruption
 * - Automatic cleanup of stale sessions
 */

import { randomUUID } from 'crypto';
import { logger } from '../../config/logger';

// Chunk size: 5MB default (can be adjusted based on network conditions)
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;
const MAX_CHUNK_SIZE = 20 * 1024 * 1024;
const MIN_CHUNK_SIZE = 1 * 1024 * 1024;

// Session timeout: 24 hours
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;

// Clean up interval: 1 hour
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export interface ChunkInfo {
  index: number;
  size: number;
  checksum?: string;
  uploadedAt: Date;
}

export interface UploadSession {
  id: string;
  userId: string;
  fileName: string;
  mimeType: string;
  totalSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: Map<number, ChunkInfo>;
  chunks: Buffer[];
  createdAt: Date;
  lastActivity: Date;
  metadata?: Record<string, unknown>;
}

export interface CreateSessionRequest {
  userId: string;
  fileName: string;
  mimeType: string;
  totalSize: number;
  chunkSize?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateSessionResponse {
  sessionId: string;
  chunkSize: number;
  totalChunks: number;
  expiresAt: Date;
}

export interface UploadChunkRequest {
  sessionId: string;
  chunkIndex: number;
  data: Buffer;
  checksum?: string;
}

export interface UploadChunkResponse {
  received: number;
  remaining: number;
  progress: number;
  isComplete: boolean;
}

export interface SessionStatusResponse {
  sessionId: string;
  fileName: string;
  totalSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  missingChunks: number[];
  progress: number;
  createdAt: Date;
  expiresAt: Date;
}

import { IChunkedUploadService } from './media.interfaces';

export class ChunkedUploadService implements IChunkedUploadService {
  private sessions: Map<string, UploadSession> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Create a new upload session
   */
  createSession(request: CreateSessionRequest): CreateSessionResponse {
    const { userId, fileName, mimeType, totalSize, chunkSize, metadata } = request;

    // Validate and normalize chunk size
    let normalizedChunkSize = chunkSize || DEFAULT_CHUNK_SIZE;
    normalizedChunkSize = Math.max(MIN_CHUNK_SIZE, Math.min(MAX_CHUNK_SIZE, normalizedChunkSize));

    const totalChunks = Math.ceil(totalSize / normalizedChunkSize);
    const sessionId = randomUUID();

    const session: UploadSession = {
      id: sessionId,
      userId,
      fileName,
      mimeType,
      totalSize,
      chunkSize: normalizedChunkSize,
      totalChunks,
      uploadedChunks: new Map(),
      chunks: new Array(totalChunks).fill(null),
      createdAt: new Date(),
      lastActivity: new Date(),
      metadata,
    };

    this.sessions.set(sessionId, session);

    logger.info('Chunked upload session created', {
      sessionId,
      userId,
      fileName,
      totalSize,
      totalChunks,
    });

    return {
      sessionId,
      chunkSize: normalizedChunkSize,
      totalChunks,
      expiresAt: new Date(Date.now() + SESSION_TIMEOUT_MS),
    };
  }

  /**
   * Upload a chunk for an existing session
   */
  uploadChunk(request: UploadChunkRequest): UploadChunkResponse {
    const { sessionId, chunkIndex, data, checksum } = request;

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Upload session not found or expired');
    }

    // Validate chunk index
    if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
      throw new Error(`Invalid chunk index: ${chunkIndex}. Expected 0-${session.totalChunks - 1}`);
    }

    // Validate chunk size (last chunk can be smaller)
    const expectedSize = chunkIndex === session.totalChunks - 1
      ? session.totalSize - (chunkIndex * session.chunkSize)
      : session.chunkSize;

    if (data.length > expectedSize) {
      throw new Error(`Chunk size ${data.length} exceeds expected size ${expectedSize}`);
    }

    // Store chunk
    session.chunks[chunkIndex] = data;
    session.uploadedChunks.set(chunkIndex, {
      index: chunkIndex,
      size: data.length,
      checksum,
      uploadedAt: new Date(),
    });
    session.lastActivity = new Date();

    const uploadedCount = session.uploadedChunks.size;
    const isComplete = uploadedCount === session.totalChunks;
    const progress = Math.round((uploadedCount / session.totalChunks) * 100);

    logger.debug('Chunk uploaded', {
      sessionId,
      chunkIndex,
      uploadedCount,
      totalChunks: session.totalChunks,
      progress,
    });

    return {
      received: uploadedCount,
      remaining: session.totalChunks - uploadedCount,
      progress,
      isComplete,
    };
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId: string): SessionStatusResponse | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const uploadedChunks = Array.from(session.uploadedChunks.keys()).sort((a, b) => a - b);
    const missingChunks: number[] = [];

    for (let i = 0; i < session.totalChunks; i++) {
      if (!session.uploadedChunks.has(i)) {
        missingChunks.push(i);
      }
    }

    return {
      sessionId: session.id,
      fileName: session.fileName,
      totalSize: session.totalSize,
      chunkSize: session.chunkSize,
      totalChunks: session.totalChunks,
      uploadedChunks,
      missingChunks,
      progress: Math.round((uploadedChunks.length / session.totalChunks) * 100),
      createdAt: session.createdAt,
      expiresAt: new Date(session.createdAt.getTime() + SESSION_TIMEOUT_MS),
    };
  }

  /**
   * Complete upload and return chunks for assembling/streaming
   */
  completeUpload(sessionId: string): { chunks: Buffer[]; session: UploadSession } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Upload session not found or expired');
    }

    // Verify all chunks are present
    for (let i = 0; i < session.totalChunks; i++) {
      if (!session.chunks[i]) {
        throw new Error(`Missing chunk at index ${i}`);
      }
    }

    // Verify total size by summing chunk lengths
    const currentSize = session.chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    if (currentSize !== session.totalSize) {
      throw new Error(`Assembled file size ${currentSize} doesn't match expected ${session.totalSize}`);
    }

    logger.info('Chunked upload completed', {
      sessionId,
      fileName: session.fileName,
      totalSize: session.totalSize,
    });

    // Remove session
    this.sessions.delete(sessionId);

    return { chunks: session.chunks, session };
  }

  /**
   * Peek at upload and return chunks for assembling/streaming without deleting session
   */
  peekUpload(sessionId: string): { chunks: Buffer[]; session: UploadSession } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Upload session not found or expired');
    }

    // Verify all chunks are present
    for (let i = 0; i < session.totalChunks; i++) {
      if (!session.chunks[i]) {
        throw new Error(`Missing chunk at index ${i}`);
      }
    }

    return { chunks: session.chunks, session };
  }

  /**
   * Cancel and clean up a session
   */
  cancelSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    this.sessions.delete(sessionId);
    logger.info('Chunked upload session cancelled', { sessionId });
    return true;
  }

  /**
   * Validate session ownership
   */
  validateOwnership(sessionId: string, userId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.userId === userId;
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId: string): SessionStatusResponse[] {
    const userSessions: SessionStatusResponse[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (session.userId === userId) {
        const status = this.getSessionStatus(sessionId);
        if (status) {
          userSessions.push(status);
        }
      }
    }

    return userSessions;
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      const age = now - session.lastActivity.getTime();
      if (age > SESSION_TIMEOUT_MS) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired chunked upload sessions', { count: cleanedCount });
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, CLEANUP_INTERVAL_MS);

    // Don't prevent Node from exiting
    this.cleanupTimer.unref();
  }

  /**
   * Stop cleanup timer (for graceful shutdown)
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    activeSessions: number;
    totalChunksStored: number;
    totalBytesStored: number;
  } {
    let totalChunks = 0;
    let totalBytes = 0;

    for (const session of this.sessions.values()) {
      totalChunks += session.uploadedChunks.size;
      for (const chunk of session.chunks) {
        if (chunk) {
          totalBytes += chunk.length;
        }
      }
    }

    return {
      activeSessions: this.sessions.size,
      totalChunksStored: totalChunks,
      totalBytesStored: totalBytes,
    };
  }
}

// Singleton instance
export const chunkedUploadService = new ChunkedUploadService();
