import { Request, Response, Router } from 'express';
import fs from 'fs';
import mongoose from 'mongoose';
import path from 'path';
import { ResponseHelper } from '../utils/response';
import { metricsService } from './metrics.service';
import { getHealthCheckData } from './monitoring.middleware';
import redisConnection from '../../config/redis';

const router = Router();

/**
 * GET /dashboard
 * Serve the monitoring dashboard HTML
 */
router.get('/dashboard', (req: Request, res: Response) => {
    try {
        const dashboardPath = path.join(__dirname, '../../monitoring-dashboard.html');
        if (fs.existsSync(dashboardPath)) {
            res.sendFile(dashboardPath);
        } else {
            res.status(404).send('Dashboard not found');
        }
    } catch (error) {
        res.status(500).send('Error loading dashboard');
    }
});


/**
 * GET /metrics
 * Prometheus metrics endpoint
 * Returns metrics in Prometheus format for scraping
 */
router.get('/metrics', async (req: Request, res: Response) => {
    try {
        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        const metrics = await metricsService.getMetrics();
        res.send(metrics);
    } catch (error) {
        ResponseHelper.error(res, 'Failed to collect metrics');
    }
});

/**
 * GET /metrics/json
 * Get metrics in JSON format for easier consumption
 */
router.get('/metrics/json', async (req: Request, res: Response) => {
    try {
        const metrics = await metricsService.getMetricsJSON();
        ResponseHelper.success(res, {
            timestamp: new Date().toISOString(),
            metrics,
        });
    } catch (error) {
        ResponseHelper.error(res, 'Failed to collect metrics');
    }
});

/**
 * GET /health
 * Health check endpoint with detailed system information
 */
router.get('/health', async (req: Request, res: Response) => {
    try {
        const healthData = await getHealthCheckData();

        // Check database connection
        const dbStatus = mongoose.connection.readyState;
        const dbStatusMap: { [key: number]: string } = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting',
        };

        // Check Redis connection
        const redisStatus = redisConnection.status;
        const isRedisHealthy = redisStatus === 'ready' || redisStatus === 'connect';

        const isHealthy = dbStatus === 1 && isRedisHealthy;
        const data = {
            ...healthData,
            status: isHealthy ? 'healthy' : 'unhealthy',
            database: {
                status: dbStatusMap[dbStatus] || 'unknown',
                connected: dbStatus === 1,
            },
            redis: {
                status: redisStatus,
                connected: isRedisHealthy,
            },
        };

        if (isHealthy) {
            ResponseHelper.success(res, data);
        } else {
            ResponseHelper.error(res, 'System unhealthy', 503, data);
        }
    } catch (error) {
        ResponseHelper.error(res, 'Health check failed', 503, {
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
        });
    }
});

/**
 * GET /health/live
 * Liveness probe - checks if the application is running
 */
router.get('/health/live', (req: Request, res: Response) => {
    ResponseHelper.success(res, {
        status: 'alive',
        timestamp: new Date().toISOString(),
    });
});

/**
 * GET /health/ready
 * Readiness probe - checks if the application is ready to serve traffic
 */
router.get('/health/ready', async (req: Request, res: Response) => {
    try {
        const dbConnected = mongoose.connection.readyState === 1;
        const redisStatus = redisConnection.status;
        const redisConnected = redisStatus === 'ready' || redisStatus === 'connect';

        const isReady = dbConnected && redisConnected;
        const data = {
            status: isReady ? 'ready' : 'not ready',
            timestamp: new Date().toISOString(),
            database: dbConnected ? 'connected' : 'not connected',
            redis: redisConnected ? 'connected' : 'not connected',
        };

        if (isReady) {
            ResponseHelper.success(res, data);
        } else {
            ResponseHelper.error(res, 'System not ready', 503, data);
        }
    } catch (error) {
        ResponseHelper.error(res, 'Readiness check failed', 503);
    }
});

/**
 * GET /stats
 * Application statistics and performance overview
 */
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const healthData = await getHealthCheckData();
        const metrics = await metricsService.getMetricsJSON();

        // Extract key metrics
        const httpRequestsTotal = metrics.find((m: any) => m.name === 'memolink_http_requests_total');
        const httpErrorsTotal = metrics.find((m: any) => m.name === 'memolink_http_request_errors_total');
        const dbQueriesTotal = metrics.find((m: any) => m.name === 'memolink_db_queries_total');
        const dbErrorsTotal = metrics.find((m: any) => m.name === 'memolink_db_query_errors_total');

        const totalRequests = httpRequestsTotal?.values?.reduce((sum: number, v: any) => sum + v.value, 0) || 0;
        const totalErrors = httpErrorsTotal?.values?.reduce((sum: number, v: any) => sum + v.value, 0) || 0;
        const totalDbQueries = dbQueriesTotal?.values?.reduce((sum: number, v: any) => sum + v.value, 0) || 0;
        const totalDbErrors = dbErrorsTotal?.values?.reduce((sum: number, v: any) => sum + v.value, 0) || 0;

        ResponseHelper.success(res, {
            timestamp: new Date().toISOString(),
            uptime: healthData.uptime,
            memory: healthData.memory,
            http: {
                totalRequests,
                totalErrors,
                errorRate: totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) + '%' : '0%',
            },
            database: {
                totalQueries: totalDbQueries,
                totalErrors: totalDbErrors,
                errorRate: totalDbQueries > 0 ? ((totalDbErrors / totalDbQueries) * 100).toFixed(2) + '%' : '0%',
                connectionStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
            },
        });
    } catch (error) {
        ResponseHelper.error(res, 'Failed to collect statistics');
    }
});

/**
 * POST /metrics/reset
 * Reset all metrics
 */
router.post('/metrics/reset', (req: Request, res: Response) => {
    try {
        metricsService.reset();
        ResponseHelper.success(res, {
            timestamp: new Date().toISOString(),
        }, 'Metrics reset successfully');
    } catch (error) {
        ResponseHelper.error(res, 'Failed to reset metrics');
    }
});


export default router;
