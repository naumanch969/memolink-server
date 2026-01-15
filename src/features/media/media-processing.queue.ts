/**
 * Media Processing Queue
 * 
 * In-memory job queue for background media processing tasks.
 * Handles:
 * - Thumbnail generation
 * - Video transcoding
 * - Metadata extraction
 * - OCR processing
 * - AI tagging
 * 
 * Note: For production, consider using Redis-based solutions like BullMQ.
 * This implementation is suitable for single-instance deployments.
 */

import { EventEmitter } from 'events';
import { logger } from '../../config/logger';
import { mediaEvents, MediaEventType } from './media.events';

// Job types
export enum MediaJobType {
  GENERATE_THUMBNAIL = 'generate_thumbnail',
  TRANSCODE_VIDEO = 'transcode_video',
  EXTRACT_METADATA = 'extract_metadata',
  RUN_OCR = 'run_ocr',
  AI_TAGGING = 'ai_tagging',
  OPTIMIZE_IMAGE = 'optimize_image',
}

// Job priorities
export enum JobPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  URGENT = 20,
}

// Job status
export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// Job interface
export interface MediaJob {
  id: string;
  type: MediaJobType;
  mediaId: string;
  userId: string;
  priority: JobPriority;
  status: JobStatus;
  data: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  error?: string;
  result?: Record<string, unknown>;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// Job processor function type
type JobProcessor = (job: MediaJob) => Promise<Record<string, unknown> | void>;

// Queue configuration
const QUEUE_CONFIG = {
  maxConcurrent: 3,
  defaultMaxAttempts: 3,
  retryDelayMs: 5000,
  stallCheckInterval: 30000,
  stallTimeout: 300000, // 5 minutes
};

/**
 * Media Processing Queue - manages background jobs
 */
class MediaProcessingQueue extends EventEmitter {
  private static instance: MediaProcessingQueue;
  private jobs: Map<string, MediaJob> = new Map();
  private processors: Map<MediaJobType, JobProcessor> = new Map();
  private processing: Set<string> = new Set();
  private isRunning: boolean = false;
  private jobIdCounter: number = 0;
  private stallCheckTimer: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.registerDefaultProcessors();
  }

  static getInstance(): MediaProcessingQueue {
    if (!MediaProcessingQueue.instance) {
      MediaProcessingQueue.instance = new MediaProcessingQueue();
    }
    return MediaProcessingQueue.instance;
  }

  /**
   * Add a job to the queue
   */
  addJob(
    type: MediaJobType,
    mediaId: string,
    userId: string,
    data: Record<string, unknown> = {},
    options: {
      priority?: JobPriority;
      maxAttempts?: number;
    } = {}
  ): MediaJob {
    const job: MediaJob = {
      id: `job_${Date.now()}_${++this.jobIdCounter}`,
      type,
      mediaId,
      userId,
      priority: options.priority || JobPriority.NORMAL,
      status: JobStatus.PENDING,
      data,
      attempts: 0,
      maxAttempts: options.maxAttempts || QUEUE_CONFIG.defaultMaxAttempts,
      createdAt: new Date(),
    };

    this.jobs.set(job.id, job);
    
    logger.info('Job added to queue', {
      jobId: job.id,
      type: job.type,
      mediaId: job.mediaId,
    });

    // Emit processing started event
    mediaEvents.emit(MediaEventType.PROCESSING_STARTED, {
      mediaId,
      userId,
      processType: this.mapJobTypeToProcessType(type),
      status: 'started',
    });

    // Trigger processing if queue is running
    if (this.isRunning) {
      this.processNext();
    }

    return job;
  }

  /**
   * Register a job processor
   */
  registerProcessor(type: MediaJobType, processor: JobProcessor): void {
    this.processors.set(type, processor);
    logger.debug('Job processor registered', { type });
  }

  /**
   * Start processing jobs
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startStallCheck();
    this.processNext();
    
    logger.info('Media processing queue started');
  }

  /**
   * Stop processing jobs
   */
  stop(): void {
    this.isRunning = false;
    this.stopStallCheck();
    
    logger.info('Media processing queue stopped');
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): MediaJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get jobs for a specific media
   */
  getJobsForMedia(mediaId: string): MediaJob[] {
    return Array.from(this.jobs.values()).filter(job => job.mediaId === mediaId);
  }

  /**
   * Get all pending jobs
   */
  getPendingJobs(): MediaJob[] {
    return Array.from(this.jobs.values())
      .filter(job => job.status === JobStatus.PENDING)
      .sort((a, b) => b.priority - a.priority || a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status === JobStatus.PROCESSING) {
      return false;
    }

    job.status = JobStatus.CANCELLED;
    logger.info('Job cancelled', { jobId });
    return true;
  }

  /**
   * Clear completed/cancelled jobs older than specified time
   */
  cleanupJobs(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [jobId, job] of this.jobs) {
      if (
        (job.status === JobStatus.COMPLETED || job.status === JobStatus.CANCELLED) &&
        job.completedAt &&
        now - job.completedAt.getTime() > maxAgeMs
      ) {
        this.jobs.delete(jobId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Cleaned up old jobs', { count: cleaned });
    }

    return cleaned;
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    let pending = 0, processing = 0, completed = 0, failed = 0, cancelled = 0;

    for (const job of this.jobs.values()) {
      switch (job.status) {
        case JobStatus.PENDING: pending++; break;
        case JobStatus.PROCESSING: processing++; break;
        case JobStatus.COMPLETED: completed++; break;
        case JobStatus.FAILED: failed++; break;
        case JobStatus.CANCELLED: cancelled++; break;
      }
    }

    return {
      total: this.jobs.size,
      pending,
      processing,
      completed,
      failed,
      cancelled,
    };
  }

  /**
   * Process next available job
   */
  private async processNext(): Promise<void> {
    if (!this.isRunning) return;
    if (this.processing.size >= QUEUE_CONFIG.maxConcurrent) return;

    const pendingJobs = this.getPendingJobs();
    if (pendingJobs.length === 0) return;

    const job = pendingJobs[0];
    await this.processJob(job);

    // Continue processing
    setImmediate(() => this.processNext());
  }

  /**
   * Process a specific job
   */
  private async processJob(job: MediaJob): Promise<void> {
    const processor = this.processors.get(job.type);
    if (!processor) {
      job.status = JobStatus.FAILED;
      job.error = `No processor registered for job type: ${job.type}`;
      logger.error('No processor for job type', { type: job.type });
      return;
    }

    job.status = JobStatus.PROCESSING;
    job.startedAt = new Date();
    job.attempts++;
    this.processing.add(job.id);

    logger.debug('Processing job', {
      jobId: job.id,
      type: job.type,
      attempt: job.attempts,
    });

    try {
      const result = await processor(job);
      
      job.status = JobStatus.COMPLETED;
      job.completedAt = new Date();
      job.result = result || {};

      // Emit processing completed event
      mediaEvents.emit(MediaEventType.PROCESSING_COMPLETED, {
        mediaId: job.mediaId,
        userId: job.userId,
        processType: this.mapJobTypeToProcessType(job.type),
        status: 'completed',
        duration: job.completedAt.getTime() - job.startedAt!.getTime(),
      });

      logger.info('Job completed', {
        jobId: job.id,
        type: job.type,
        duration: job.completedAt.getTime() - job.startedAt!.getTime(),
      });

      this.emit('completed', job);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      if (job.attempts < job.maxAttempts) {
        // Retry
        job.status = JobStatus.PENDING;
        job.error = errorMsg;
        
        logger.warn('Job failed, will retry', {
          jobId: job.id,
          type: job.type,
          attempt: job.attempts,
          maxAttempts: job.maxAttempts,
          error: errorMsg,
        });

        // Schedule retry
        setTimeout(() => {
          if (this.isRunning) {
            this.processNext();
          }
        }, QUEUE_CONFIG.retryDelayMs);
      } else {
        // Max attempts reached
        job.status = JobStatus.FAILED;
        job.completedAt = new Date();
        job.error = errorMsg;

        // Emit processing failed event
        mediaEvents.emit(MediaEventType.PROCESSING_FAILED, {
          mediaId: job.mediaId,
          userId: job.userId,
          processType: this.mapJobTypeToProcessType(job.type),
          status: 'failed',
          error: errorMsg,
        });

        logger.error('Job failed permanently', {
          jobId: job.id,
          type: job.type,
          attempts: job.attempts,
          error: errorMsg,
        });

        this.emit('failed', job);
      }
    } finally {
      this.processing.delete(job.id);
    }
  }

  /**
   * Map job type to process type for events
   */
  private mapJobTypeToProcessType(type: MediaJobType): 'transcoding' | 'thumbnail' | 'metadata' | 'ocr' | 'ai-tagging' {
    switch (type) {
      case MediaJobType.TRANSCODE_VIDEO: return 'transcoding';
      case MediaJobType.GENERATE_THUMBNAIL: return 'thumbnail';
      case MediaJobType.EXTRACT_METADATA: return 'metadata';
      case MediaJobType.RUN_OCR: return 'ocr';
      case MediaJobType.AI_TAGGING: return 'ai-tagging';
      default: return 'metadata';
    }
  }

  /**
   * Start stall detection
   */
  private startStallCheck(): void {
    this.stallCheckTimer = setInterval(() => {
      this.checkStalledJobs();
    }, QUEUE_CONFIG.stallCheckInterval);
    this.stallCheckTimer.unref();
  }

  /**
   * Stop stall detection
   */
  private stopStallCheck(): void {
    if (this.stallCheckTimer) {
      clearInterval(this.stallCheckTimer);
      this.stallCheckTimer = null;
    }
  }

  /**
   * Check for stalled jobs
   */
  private checkStalledJobs(): void {
    const now = Date.now();

    for (const job of this.jobs.values()) {
      if (
        job.status === JobStatus.PROCESSING &&
        job.startedAt &&
        now - job.startedAt.getTime() > QUEUE_CONFIG.stallTimeout
      ) {
        logger.warn('Stalled job detected', {
          jobId: job.id,
          type: job.type,
          startedAt: job.startedAt,
        });

        // Reset to pending for retry
        job.status = JobStatus.PENDING;
        this.processing.delete(job.id);
      }
    }
  }

  /**
   * Register default job processors
   */
  private registerDefaultProcessors(): void {
    // Placeholder processors - these would integrate with actual services
    
    this.registerProcessor(MediaJobType.GENERATE_THUMBNAIL, async (job) => {
      logger.debug('Generating thumbnail', { mediaId: job.mediaId });
      // Implementation would call CloudinaryService or other thumbnail generator
      return { thumbnailUrl: 'generated' };
    });

    this.registerProcessor(MediaJobType.EXTRACT_METADATA, async (job) => {
      logger.debug('Extracting metadata', { mediaId: job.mediaId });
      // Implementation would extract EXIF, video info, etc.
      return { metadata: {} };
    });

    this.registerProcessor(MediaJobType.RUN_OCR, async (job) => {
      logger.debug('Running OCR', { mediaId: job.mediaId });
      // Implementation would call OCR service
      return { text: '', confidence: 0 };
    });

    this.registerProcessor(MediaJobType.AI_TAGGING, async (job) => {
      logger.debug('Running AI tagging', { mediaId: job.mediaId });
      // Implementation would call AI tagging service
      return { tags: [] };
    });

    this.registerProcessor(MediaJobType.TRANSCODE_VIDEO, async (job) => {
      logger.debug('Transcoding video', { mediaId: job.mediaId });
      // Implementation would handle video transcoding
      return { transcodedUrl: 'transcoded' };
    });

    this.registerProcessor(MediaJobType.OPTIMIZE_IMAGE, async (job) => {
      logger.debug('Optimizing image', { mediaId: job.mediaId });
      // Implementation would optimize image
      return { optimizedUrl: 'optimized' };
    });
  }
}

// Export singleton instance
export const mediaProcessingQueue = MediaProcessingQueue.getInstance();

// Start queue automatically
mediaProcessingQueue.start();
