import mongoose from 'mongoose';
import os from 'os';
import { logger } from '../../config/logger';
import { getEmailQueue } from '../email/queue/email.queue';
import { mediaProcessingQueue } from '../media/media-processing.queue';

export interface SystemHealth {
    uptime: number;
    timestamp: Date;
    environment: string;
    version: string;
    memory: {
        total: number;
        free: number;
        used: number;
        usagePercentage: number;
    };
    cpu: {
        loadAvg: number[]; // 1, 5, 15 min
        cores: number;
    };
}

export interface DatabaseStats {
    connected: boolean;
    name: string;
    collections: number;
    objects: number;
    avgObjSize: number;
    dataSize: number;
    storageSize: number;
    indexes: number;
    indexSize: number;
    ok: number;
}

export interface JobQueueParams {
    name: string;
    active: number;
    pending: number; // waiting
    completed: number;
    failed: number;
    delayed?: number;
    paused?: boolean;
}

export class MonitoringService {
    /**
     * Get low-level system metrics (CPU, Memory, Uptime)
     */
    async getSystemMetrics(): Promise<SystemHealth> {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        return {
            uptime: os.uptime(),
            timestamp: new Date(),
            environment: process.env.NODE_ENV || 'development',
            version: process.env.npm_package_version || '1.0.0',
            memory: {
                total: totalMem,
                free: freeMem,
                used: usedMem,
                usagePercentage: Math.round((usedMem / totalMem) * 100),
            },
            cpu: {
                loadAvg: os.loadavg(),
                cores: os.cpus().length,
            },
        };
    }

    /**
     * Get MongoDB connection stats
     */
    async getDatabaseStats(): Promise<DatabaseStats> {
        try {
            if (mongoose.connection.readyState !== 1) {
                throw new Error('Database not connected');
            }

            const db = mongoose.connection.db;
            if (!db) {
                throw new Error('Database handle not available');
            }
            const stats = await db.stats();

            return {
                connected: true,
                name: db.databaseName,
                collections: stats.collections,
                objects: stats.objects,
                avgObjSize: stats.avgObjSize,
                dataSize: stats.dataSize,
                storageSize: stats.storageSize,
                indexes: stats.indexes,
                indexSize: stats.indexSize,
                ok: stats.ok,
            };
        } catch (error) {
            logger.error('Failed to get DB stats:', error);
            // Return a "safe" error state object
            return {
                connected: false,
                name: 'unknown',
                collections: 0,
                objects: 0,
                avgObjSize: 0,
                dataSize: 0,
                storageSize: 0,
                indexes: 0,
                indexSize: 0,
                ok: 0,
            };
        }
    }

    /**
     * Get stats for all background job queues
     */
    async getJobQueues(): Promise<JobQueueParams[]> {
        const queues: JobQueueParams[] = [];

        // 1. Email Queue (BullMQ)
        try {
            const emailQ = getEmailQueue();
            const counts = await emailQ.getJobCounts(
                'active',
                'waiting',
                'completed',
                'failed',
                'delayed',
                'paused'
            );

            queues.push({
                name: 'Email Delivery',
                active: counts.active,
                pending: counts.waiting,
                completed: counts.completed,
                failed: counts.failed,
                delayed: counts.delayed,
                paused: counts.paused > 0, // BullMQ counts returns number of paused jobs? Or implies queue is paused? Usually queue.isPaused() is better but counts works for summary.
            });
        } catch (error) {
            logger.error('Failed to get email queue stats:', error);
        }

        // 2. Media Processing Queue (In-Memory Custom)
        try {
            const mediaStats = mediaProcessingQueue.getStats();
            queues.push({
                name: 'Media Processing',
                active: mediaStats.processing,
                pending: mediaStats.pending,
                completed: mediaStats.completed,
                failed: mediaStats.failed,
                paused: false,
            });
        } catch (error) {
            logger.error('Failed to get media queue stats:', error);
        }

        return queues;
    }
}

export const monitoringService = new MonitoringService();
