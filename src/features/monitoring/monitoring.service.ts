import mongoose from 'mongoose';
import os from 'os';
import { logger } from '../../config/logger';
import { getEmailQueue } from '../email/queue/email.queue';
import Entry from '../entry/entry.model';
import { SystemMetric } from './metrics.service';

export interface SystemHealth {
    status: 'healthy' | 'unhealthy';
    uptime: {
        seconds: number;
        formatted: string;
    };
    timestamp: Date;
    environment: string;
    version: string;
    memory: {
        total: number;
        free: number;
        used: number;
        usagePercentage: number;
        rss: string;
        heapTotal: string;
        heapUsed: string;
    };
    cpu: {
        loadAvg: number[];
        cores: number;
    };
    database: {
        connected: boolean;
        status: string;
    };
    redis: {
        connected: boolean;
        status: string;
    };
}

export class MonitoringService {
    /**
     * Get comprehensive system health
     */
    async getFullHealth(): Promise<SystemHealth> {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const uptime = process.uptime();
        const memUsage = process.memoryUsage();

        const dbStatus = mongoose.connection.readyState;
        const dbConnected = dbStatus === 1;

        // Dynamic import to avoid circular dependency if needed
        const redisConnection = (await import('../../config/redis')).default;
        const redisStatus = redisConnection.status;
        const redisConnected = redisStatus === 'ready' || redisStatus === 'connect';

        return {
            status: (dbConnected && redisConnected) ? 'healthy' : 'unhealthy',
            uptime: {
                seconds: uptime,
                formatted: this.formatUptime(uptime),
            },
            timestamp: new Date(),
            environment: process.env.NODE_ENV || 'development',
            version: process.env.npm_package_version || '1.0.0',
            memory: {
                total: totalMem,
                free: freeMem,
                used: usedMem,
                usagePercentage: Math.round((usedMem / totalMem) * 100),
                rss: this.formatBytes(memUsage.rss),
                heapTotal: this.formatBytes(memUsage.heapTotal),
                heapUsed: this.formatBytes(memUsage.heapUsed),
            },
            cpu: {
                loadAvg: os.loadavg(),
                cores: os.cpus().length,
            },
            database: {
                connected: dbConnected,
                status: this.getDbStatusLabel(dbStatus),
            },
            redis: {
                connected: redisConnected,
                status: redisStatus,
            }
        };
    }

    /**
     * Get Database stats (Size, Objects, etc)
     */
    async getDatabaseStats() {
        try {
            if (mongoose.connection.readyState !== 1) return { connected: false };
            const db = mongoose.connection.db;
            if (!db) return { connected: false };
            const stats = await db.stats();
            return {
                connected: true,
                name: db.databaseName,
                collections: stats.collections,
                objects: stats.objects,
                dataSize: this.formatBytes(stats.dataSize),
                storageSize: this.formatBytes(stats.storageSize),
            };
        } catch (error) {
            logger.error('Failed to get DB stats:', error);
            return { connected: false };
        }
    }

    /**
     * Get Infrastructure usage tracking
     */
    async getInfrastructureMetrics() {
        const metrics = await SystemMetric.find({
            key: { $in: ['redis:errors', 'redis:limit_hits', 'redis:queues_initialized'] }
        });

        const untaggedCount = await Entry.countDocuments({
            aiProcessed: { $ne: true },
            content: { $exists: true, $ne: '' },
            $expr: { $gt: [{ $strLenCP: "$content" }, 20] }
        });

        return {
            redis: {
                errors: metrics.find(m => m.key === 'redis:errors')?.count || 0,
                hits: metrics.find(m => m.key === 'redis:limit_hits')?.count || 0,
            },
            selfHealing: {
                pendingEntries: untaggedCount
            }
        };
    }

    async getJobQueues() {
        try {
            const emailQ = getEmailQueue();
            const counts = await emailQ.getJobCounts();
            return [{
                name: 'Email Delivery',
                active: counts.active,
                pending: counts.waiting,
                failed: counts.failed,
                completed: counts.completed
            }];
        } catch (err) {
            return [];
        }
    }

    // Helper methods
    private formatBytes(bytes: number): string {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    private formatUptime(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h}h ${m}m ${s}s`;
    }

    private getDbStatusLabel(status: number): string {
        return { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' }[status] || 'unknown';
    }
}

export const monitoringService = new MonitoringService();
