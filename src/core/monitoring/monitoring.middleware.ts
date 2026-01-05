import { Request, Response, NextFunction } from 'express';
import responseTime from 'response-time';
import { metricsService } from './metrics.service';
import { logger } from '../../config/logger';

/**
 * Monitoring Middleware - Tracks HTTP request metrics
 */
export const monitoringMiddleware = responseTime((req: Request, res: Response, time: number) => {
    // Extract route pattern (remove IDs and dynamic segments for better grouping)
    const route = normalizeRoute(req.route?.path || req.path);
    const method = req.method;
    const statusCode = res.statusCode;

    // Convert time from milliseconds to seconds
    const duration = time / 1000;

    // Get request and response sizes
    const requestSize = parseInt(req.get('content-length') || '0', 10);
    const responseSize = parseInt(res.get('content-length') || '0', 10);

    // Record metrics
    metricsService.recordHttpRequest(
        method,
        route,
        statusCode,
        duration,
        requestSize,
        responseSize
    );

    // Log slow requests (> 1 second)
    if (duration > 1) {
        logger.warn('Slow request detected', {
            method,
            route,
            duration: `${duration.toFixed(3)}s`,
            statusCode,
        });
    }
});

/**
 * Normalize route path for better metric grouping
 * Replaces dynamic segments with placeholders
 */
function normalizeRoute(path: string): string {
    return path
        // Replace MongoDB ObjectIDs
        .replace(/[0-9a-f]{24}/gi, ':id')
        // Replace UUIDs
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':uuid')
        // Replace numeric IDs
        .replace(/\/\d+/g, '/:id')
        // Replace date patterns (YYYY-MM-DD)
        .replace(/\/\d{4}-\d{2}-\d{2}/g, '/:date')
        // Limit length
        .substring(0, 100);
}

/**
 * Database Query Monitoring Wrapper
 * Wraps database operations to track performance
 */
export function monitorDbQuery<T>(
    operation: string,
    collection: string,
    queryFn: () => Promise<T>
): Promise<T> {
    const startTime = Date.now();

    return queryFn()
        .then((result) => {
            const duration = (Date.now() - startTime) / 1000;
            metricsService.recordDbQuery(operation, collection, duration);

            // Log slow queries (> 500ms)
            if (duration > 0.5) {
                logger.warn('Slow database query detected', {
                    operation,
                    collection,
                    duration: `${duration.toFixed(3)}s`,
                });
            }

            return result;
        })
        .catch((error) => {
            const duration = (Date.now() - startTime) / 1000;
            metricsService.recordDbQuery(operation, collection, duration, error);
            throw error;
        });
}

/**
 * Request Context Middleware
 * Adds request ID and timing information
 */
export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Generate unique request ID
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Attach to request
    (req as any).requestId = requestId;
    (req as any).startTime = Date.now();

    // Add to response headers for tracing
    res.setHeader('X-Request-ID', requestId);

    next();
};

/**
 * Error Tracking Middleware
 * Captures and logs errors with context
 */
export const errorTrackingMiddleware = (err: Error, req: Request, res: Response, next: NextFunction) => {
    const requestId = (req as any).requestId;
    const duration = Date.now() - ((req as any).startTime || Date.now());

    logger.error('Request error', {
        requestId,
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
    });

    next(err);
};

/**
 * Health Check Data Provider
 */
export async function getHealthCheckData() {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: {
            seconds: uptime,
            formatted: formatUptime(uptime),
        },
        memory: {
            rss: formatBytes(memUsage.rss),
            heapTotal: formatBytes(memUsage.heapTotal),
            heapUsed: formatBytes(memUsage.heapUsed),
            external: formatBytes(memUsage.external),
            heapUsedPercentage: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2) + '%',
        },
        cpu: {
            user: process.cpuUsage().user,
            system: process.cpuUsage().system,
        },
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
    };
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format uptime to human-readable format
 */
function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
}
