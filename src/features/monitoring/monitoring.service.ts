import mongoose from 'mongoose';
import os from 'os';
import { logger } from '../../config/logger';
import { bufferManager } from '../../core/telemetry/buffer.manager';
import { getEmailQueue } from '../email/queue/email.queue';
import Entry from '../entry/entry.model';
import { llmUsageService } from '../llm-usage/llm-usage.service';
import { SystemMetric } from './metric.model';

import { SystemHealth } from './monitoring.types';

export class MonitoringService {
    /**
     * Get Aggregated Dashboard Metrics for the last 24 hours
     */
    async getDashboardMetrics() {
        // Calculate the last 24 hours periods
        const periods = [];
        const now = new Date();
        for (let i = 0; i < 24; i++) {
            const d = new Date(now.getTime() - i * 60 * 60 * 1000);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hour = String(d.getHours()).padStart(2, '0');
            periods.push(`${year}-${month}-${day}:${hour}`);
        }

        // Fetch all metrics for these periods
        const metrics: any[] = await SystemMetric.find({
            period: { $in: periods }
        }).lean();

        // MERGE PENDING METRICS (Real-time view)
        const pending = bufferManager.getPendingMetrics();
        const currentPeriod = periods[0]; // The most recent hour (or based on getPeriodKey)

        // 1. Merge Counters (additive) - Buffer counters accumulate since last flush
        // If the DB already has data for this hour, we add the buffer to it implicitly by pushing a new entry
        // The reduce() logic later sums all entries for the same key, so duplicates are fine.
        Object.entries(pending.counters).forEach(([key, value]) => {
            metrics.push({ key, value, period: currentPeriod });
        });

        // 2. Merge Gauges (max) - Buffer gauges track max since last flush
        Object.entries(pending.gauges).forEach(([key, value]) => {
            // We need to check if there is an existing metric to compare against
            const existingIndex = metrics.findIndex(m => m.key === key && m.period === currentPeriod);

            if (existingIndex >= 0) {
                metrics[existingIndex].value = Math.max(metrics[existingIndex].value, value as number);
            } else {
                metrics.push({ key, value, period: currentPeriod });
            }
        });

        // Aggregate by Key Type
        let aiCost = metrics.filter(m => m.key === 'ai:cost:usd').reduce((sum, m) => sum + m.value, 0);
        const totalTokens = metrics.filter(m => m.key.startsWith('ai:tokens:')).reduce((sum, m) => sum + m.value, 0);
        const httpRequests = metrics.filter(m => m.key.startsWith('http:status:')).reduce((sum, m) => sum + m.value, 0);
        const dbQueries = metrics.filter(m => m.key === 'db:queries:total').reduce((sum, m) => sum + m.value, 0);

        // Fetch accurate cost from Audit Logs as well (to prevent "missing data" issues)
        // This ensures the dashboard matches the Gemini Cost Report
        const geminiSummary = await llmUsageService.getGeminiCostsSummary();
        const accurateMonthlyCost = geminiSummary.projectedMonthEndCostUSD;

        // If Audit Log has cost data this month but SystemMetric (fast path) is showing 0, 
        // it means SystemMetric missed the data (or we are in a transition period).
        // Since getDashboardMetrics() is focused on 24h, let's grab the last day from summary trend.
        if (geminiSummary.dailyTrend.length > 0) {
            const todayStr = new Date().toISOString().split('T')[0];
            const todayLog = geminiSummary.dailyTrend.find(d => d.date === todayStr);
            if (todayLog && todayLog.estimatedCostUSD > aiCost) {
                aiCost = todayLog.estimatedCostUSD;
            }
        }

        // Latency
        const httpLatencySum = metrics.filter(m => m.key === 'http:latency:sum').reduce((sum, m) => sum + m.value, 0);
        const httpLatencyCount = metrics.filter(m => m.key === 'http:requests:total').reduce((sum, m) => sum + m.value, 0);
        const avgLatency = httpLatencyCount > 0 ? Math.round(httpLatencySum / httpLatencyCount) : 0;

        // Errors
        const httpErrors = metrics.filter(m => m.key === 'http:errors').reduce((sum, m) => sum + m.value, 0);
        const errorRate = httpRequests > 0 ? Number(((httpErrors / httpRequests) * 100).toFixed(2)) : 0;

        // Detailed Costs Breakdown
        // Group by model
        const modelCosts: Record<string, number> = {};
        metrics.filter(m => m.key.startsWith('ai:cost:usd')).forEach(m => {
            // If we tracked model specific cost (e.g. ai:cost:usd:gemini-1.5), we could split here.
        });

        const modelUsage: Record<string, number> = {};
        metrics.filter(m => m.key.startsWith('ai:requests:')).forEach(m => {
            const model = m.key.split(':')[2];
            modelUsage[model] = (modelUsage[model] || 0) + m.value;
        });

        // Group by period for charts
        const chartData = periods.reverse().map(period => ({
            period,
            aiCost: metrics.find(m => m.key === 'ai:cost:usd' && m.period === period)?.value || 0,
            requests: metrics.filter(m => m.key.startsWith('http:status:') && m.period === period)
                .reduce((sum, m) => sum + m.value, 0),
            dbQueries: metrics.find(m => m.key === 'db:queries:total' && m.period === period)?.value || 0,
            cpuLoad: metrics.find(m => m.key === 'system:cpu:load' && m.period === period)?.value || 0,
            memory: metrics.find(m => m.key === 'system:memory:rss' && m.period === period)?.value || 0,
        }));

        // Advanced Forecasting (Historical + Current Trend)
        // 1. Fetch last 15 days of daily rollups for context
        const pastDays = [];
        for (let i = 1; i <= 15; i++) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            pastDays.push(`${y}-${m}-${day}`);
        }

        const historicalMetrics = await SystemMetric.find({
            key: 'ai:cost:usd',
            period: { $in: pastDays }
        }).lean();

        // 2. Calculate daily average from history
        let historicalAvgDaily = 0;
        if (historicalMetrics.length > 0) {
            const totalHistorical = historicalMetrics.reduce((sum, m) => sum + m.value, 0);
            historicalAvgDaily = totalHistorical / historicalMetrics.length;
        }

        // 3. Weighted Projection: 50% History, 50% Current Trend (Last 24h)
        const currentTrendDaily = aiCost;

        let weightedDailyCost = currentTrendDaily;
        if (historicalAvgDaily > 0) {
            // If we have history, blend it. 
            // If current 24h is abnormally high/low, history dampens the volatility.
            weightedDailyCost = (historicalAvgDaily * 0.5) + (currentTrendDaily * 0.5);
        }

        // 4. Project for 30 days
        let projectedMonthlyCost = weightedDailyCost * 30;

        // CORRECTION: Since we have the *actual* month-to-date cost in Audit Logs, 
        // we should base our projection on capable data if SystemMetric is lagging/empty.
        if (accurateMonthlyCost > projectedMonthlyCost) {
            projectedMonthlyCost = accurateMonthlyCost;
        }

        return {
            summary: {
                aiCost24h: aiCost,
                totalTokens24h: totalTokens,
                httpRequests24h: httpRequests,
                dbQueries24h: dbQueries,
                projectedMonthlyCost,
                actualMonthlyCost: geminiSummary.monthly.estimatedCostUSD,
                avgLatency,
                errorRate
            },
            usage: {
                byModel: modelUsage
            },
            chart: chartData
        };
    }

    /**
     * Get comprehensive system health
     */
    async getFullHealth(): Promise<SystemHealth> {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const uptime = process.uptime();
        const memUsage = process.memoryUsage();

        const dbStatus = mongoose.connection.readyState;
        const dbConnected = dbStatus === 1;

        // Dynamic import to avoid circular dependency if needed
        const redisConnection = (await import('../../config/redis')).default;
        const redisStatus = redisConnection.status;
        const redisConnected = redisStatus === 'ready' || redisStatus === 'connect';

        // Use Process Memory for "Used" to reflect App footprint, not System total (which includes OS cache)
        const usedMem = memUsage.rss;

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
                usagePercentage: Number(((usedMem / totalMem) * 100).toFixed(2)),
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

            const stats: any = await db.command({ dbStats: 1 });

            // Get collection-level stats
            const collections = await db.listCollections().toArray();
            const collectionStats = await Promise.all(collections.map(async (col) => {
                const colStats: any = await db.command({ collStats: col.name });
                return {
                    name: col.name,
                    count: colStats.count,
                    size: colStats.size,
                    storageSize: colStats.storageSize,
                    avgObjSize: colStats.avgObjSize,
                    indexes: colStats.nindexes,
                    totalIndexSize: colStats.totalIndexSize
                };
            }));

            // Sort by storageSize descending and take top 10
            const topCollections = collectionStats
                .sort((a, b) => b.storageSize - a.storageSize)
                .slice(0, 10);

            return {
                connected: true,
                name: db.databaseName,
                collections: stats.collections,
                objects: stats.objects,
                dataSize: stats.dataSize,
                storageSize: stats.storageSize,
                topCollections // Add this new field
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
                errors: metrics.find(m => m.key === 'redis:errors')?.value || 0,
                hits: metrics.find(m => m.key === 'redis:limit_hits')?.value || 0,
            },
            selfHealing: {
                pendingEntries: untaggedCount
            },
            cloudinary: await this.getCloudinaryUsage()
        };
    }

    private async getCloudinaryUsage() {
        try {
            // Lazy load to avoid startup issues if not configured
            const { v2: cloudinary } = await import('cloudinary');
            cloudinary.config({
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET
            });

            const usage = await cloudinary.api.usage();
            return {
                usage: usage.storage?.usage || 0,
                limit: usage.storage?.limit || 0,
                credits_usage: usage.credits?.usage || 0
            };
        } catch (error) {
            // logger.warn('Failed to fetch Cloudinary usage', error);
            return { usage: 0, limit: 0, credits_usage: 0 };
        }
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
