import { Router, Request, Response } from 'express';
import { metricsService } from './metrics.service';
import { getHealthCheckData } from './monitoring.middleware';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';

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
        res.status(500).json({ error: 'Failed to collect metrics' });
    }
});

/**
 * GET /metrics/json
 * Get metrics in JSON format for easier consumption
 */
router.get('/metrics/json', async (req: Request, res: Response) => {
    try {
        const metrics = await metricsService.getMetricsJSON();
        res.json({
            timestamp: new Date().toISOString(),
            metrics,
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to collect metrics' });
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

        const isHealthy = dbStatus === 1;

        res.status(isHealthy ? 200 : 503).json({
            ...healthData,
            status: isHealthy ? 'healthy' : 'unhealthy',
            database: {
                status: dbStatusMap[dbStatus] || 'unknown',
                connected: dbStatus === 1,
            },
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: 'Health check failed',
            timestamp: new Date().toISOString(),
        });
    }
});

/**
 * GET /health/live
 * Liveness probe - checks if the application is running
 */
router.get('/health/live', (req: Request, res: Response) => {
    res.status(200).json({
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
        // Check database connection
        const dbConnected = mongoose.connection.readyState === 1;

        if (dbConnected) {
            res.status(200).json({
                status: 'ready',
                timestamp: new Date().toISOString(),
                database: 'connected',
            });
        } else {
            res.status(503).json({
                status: 'not ready',
                timestamp: new Date().toISOString(),
                database: 'not connected',
            });
        }
    } catch (error) {
        res.status(503).json({
            status: 'not ready',
            error: 'Readiness check failed',
            timestamp: new Date().toISOString(),
        });
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

        // Calculate totals
        const totalRequests = httpRequestsTotal?.values?.reduce((sum: number, v: any) => sum + v.value, 0) || 0;
        const totalErrors = httpErrorsTotal?.values?.reduce((sum: number, v: any) => sum + v.value, 0) || 0;
        const totalDbQueries = dbQueriesTotal?.values?.reduce((sum: number, v: any) => sum + v.value, 0) || 0;
        const totalDbErrors = dbErrorsTotal?.values?.reduce((sum: number, v: any) => sum + v.value, 0) || 0;

        res.json({
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
        res.status(500).json({ error: 'Failed to collect statistics' });
    }
});

/**
 * POST /metrics/reset
 * Reset all metrics (useful for testing/development)
 * Should be protected in production
 */
router.post('/metrics/reset', (req: Request, res: Response) => {
    try {
        metricsService.reset();
        res.json({
            message: 'Metrics reset successfully',
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reset metrics' });
    }
});

export default router;
