import { NextFunction, Request, Response } from 'express';
import responseTime from 'response-time';
import { logger } from '../../config/logger';
import { metricsService } from '../../features/monitoring/metrics.service';
import { telemetryBus } from '../telemetry/telemetry.bus';

// Monitoring Middleware - Tracks HTTP request metrics
export class MonitoringMiddleware {

    // Request Context Middleware - Adds request ID and timing information
    static addRequestContext(req: Request, res: Response, next: NextFunction) {
        // Generate unique request ID
        const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Attach to request
        (req as any).requestId = requestId;
        (req as any).startTime = Date.now();

        // Add to response headers for tracing
        res.setHeader('X-Request-ID', requestId);

        next();
    };

    static monitorHTTP() {
        return responseTime((req: Request, res: Response, time: number) => {

            // Extract route pattern (remove IDs and dynamic segments for better grouping)
            const route = MonitoringMiddleware.normalizeRoute(req.route?.path || req.path);
            const method = req.method;
            const statusCode = res.statusCode;

            // Convert time from milliseconds to seconds
            const duration = time / 1000;

            // Get request and response sizes
            const requestSize = parseInt(req.get('content-length') || '0', 10);
            const responseSize = parseInt(res.get('content-length') || '0', 10);

            // Record metrics
            metricsService.recordHttpRequest(method, route, statusCode, duration);

            // Emit Telemetry Event
            telemetryBus.emitHTTP({
                method,
                route,
                statusCode,
                duration: time,       // ms
                responseTime: time,   // ms
                egressBytes: responseSize
            });

            // Log slow requests (> 1 second)
            if (duration > 1) {
                logger.warn('Slow request detected', {
                    method,
                    route,
                    duration: `${duration.toFixed(3)}s`,
                    statusCode,
                });
            }
        })
    }

    // Database Query Monitoring Wrapper - Wraps database operations to track performance
    static monitorDbQuery<T>(operation: string, collection: string, queryFn: () => Promise<T>): Promise<T> {
        const startTime = Date.now();

        return queryFn()
            .then((result) => {
                const duration = (Date.now() - startTime) / 1000;
                metricsService.recordDbQuery(operation, collection, duration);

                // Log slow queries (> 500ms)
                if (duration > 0.5) {
                    logger.warn('Slow database query detected', { operation, collection, duration: `${duration.toFixed(3)}s`, });
                }

                return result;
            })
            .catch((error) => {
                const duration = (Date.now() - startTime) / 1000;
                metricsService.recordDbQuery(operation, collection, duration);
                throw error;
            });
    }

    // Error Tracking Middleware - Captures and logs errors with context
    static errorTrackingMiddleware(err: Error, req: Request, res: Response, next: NextFunction) {
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

    // Normalize route path for better metric grouping - Replaces dynamic segments with placeholders
    static normalizeRoute(path: string): string {
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

}
