/**
 * Media Events System
 * 
 * Provides event-driven architecture for media operations.
 * Other parts of the application can subscribe to media events
 * to react to uploads, deletions, and processing completion.
 */

import { EventEmitter } from 'events';
import { logger } from '../../config/logger';
import { IMedia } from '../../shared/types';

// Event types for type safety
export enum MediaEventType {
  UPLOADED = 'media.uploaded',
  DELETED = 'media.deleted',
  UPDATED = 'media.updated',
  PROCESSING_STARTED = 'media.processing.started',
  PROCESSING_COMPLETED = 'media.processing.completed',
  PROCESSING_FAILED = 'media.processing.failed',
  THUMBNAIL_GENERATED = 'media.thumbnail.generated',
  METADATA_EXTRACTED = 'media.metadata.extracted',
  OCR_COMPLETED = 'media.ocr.completed',
  AI_TAGGED = 'media.ai.tagged',
}

// Event payload types
export interface MediaUploadedEvent {
  media: IMedia;
  userId: string;
  uploadDuration?: number;
  source?: 'web' | 'mobile' | 'api';
}

export interface MediaDeletedEvent {
  mediaId: string;
  userId: string;
  cloudinaryId?: string;
  size: number;
}

export interface MediaUpdatedEvent {
  media: IMedia;
  userId: string;
  changes: string[];
}

export interface MediaProcessingEvent {
  mediaId: string;
  userId: string;
  processType: 'transcoding' | 'thumbnail' | 'metadata' | 'ocr' | 'ai-tagging';
  status: 'started' | 'completed' | 'failed';
  error?: string;
  duration?: number;
}

export interface MediaMetadataEvent {
  mediaId: string;
  userId: string;
  metadataType: 'exif' | 'video' | 'document';
  data: Record<string, unknown>;
}

export interface MediaOcrEvent {
  mediaId: string;
  userId: string;
  text: string;
  confidence: number;
}

export interface MediaAiTagEvent {
  mediaId: string;
  userId: string;
  tags: Array<{ tag: string; confidence: number }>;
}

// Type mapping for event handlers
export interface MediaEventMap {
  [MediaEventType.UPLOADED]: MediaUploadedEvent;
  [MediaEventType.DELETED]: MediaDeletedEvent;
  [MediaEventType.UPDATED]: MediaUpdatedEvent;
  [MediaEventType.PROCESSING_STARTED]: MediaProcessingEvent;
  [MediaEventType.PROCESSING_COMPLETED]: MediaProcessingEvent;
  [MediaEventType.PROCESSING_FAILED]: MediaProcessingEvent;
  [MediaEventType.THUMBNAIL_GENERATED]: MediaProcessingEvent;
  [MediaEventType.METADATA_EXTRACTED]: MediaMetadataEvent;
  [MediaEventType.OCR_COMPLETED]: MediaOcrEvent;
  [MediaEventType.AI_TAGGED]: MediaAiTagEvent;
}

type MediaEventHandler<T extends MediaEventType> = (payload: MediaEventMap[T]) => void | Promise<void>;

/**
 * Media Event Emitter - Singleton class for media events
 */
class MediaEventEmitter {
  private emitter: EventEmitter;
  private static instance: MediaEventEmitter;

  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50); // Allow more listeners for extensibility
  }

  static getInstance(): MediaEventEmitter {
    if (!MediaEventEmitter.instance) {
      MediaEventEmitter.instance = new MediaEventEmitter();
    }
    return MediaEventEmitter.instance;
  }

  /**
   * Emit a media event
   */
  emit<T extends MediaEventType>(event: T, payload: MediaEventMap[T]): void {
    logger.debug(`Media event emitted: ${event}`, { 
      event,
      mediaId: 'mediaId' in payload ? payload.mediaId : undefined,
    });
    this.emitter.emit(event, payload);
  }

  /**
   * Subscribe to a media event
   */
  on<T extends MediaEventType>(event: T, handler: MediaEventHandler<T>): void {
    this.emitter.on(event, handler);
    logger.debug(`Media event handler registered: ${event}`);
  }

  /**
   * Subscribe to a media event once
   */
  once<T extends MediaEventType>(event: T, handler: MediaEventHandler<T>): void {
    this.emitter.once(event, handler);
  }

  /**
   * Unsubscribe from a media event
   */
  off<T extends MediaEventType>(event: T, handler: MediaEventHandler<T>): void {
    this.emitter.off(event, handler);
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: MediaEventType): void {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
  }

  /**
   * Get listener count for an event
   */
  listenerCount(event: MediaEventType): number {
    return this.emitter.listenerCount(event);
  }
}

// Export singleton instance
export const mediaEvents = MediaEventEmitter.getInstance();

/**
 * Example usage in other parts of the app:
 * 
 * // Subscribe to events
 * mediaEvents.on(MediaEventType.UPLOADED, (event) => {
 *   console.log(`New media uploaded: ${event.media._id}`);
 *   // Trigger analytics, notifications, etc.
 * });
 * 
 * mediaEvents.on(MediaEventType.DELETED, (event) => {
 *   console.log(`Media deleted: ${event.mediaId}`);
 *   // Clean up related data, update counts, etc.
 * });
 * 
 * // Emit events (done in media.controller.ts)
 * mediaEvents.emit(MediaEventType.UPLOADED, {
 *   media: createdMedia,
 *   userId: req.user.id,
 *   source: 'web',
 * });
 */
