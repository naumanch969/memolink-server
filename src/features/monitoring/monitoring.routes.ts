import { Router } from 'express';
import { metricsService } from './metrics.service';
import { MonitoringController } from './monitoring.controller';

const monitoringRouter = Router();

// 1. Prometheus Metrics (Public/System)
// Returns metrics in Prometheus plain text format
monitoringRouter.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        const metrics = await metricsService.getMetrics();
        res.send(metrics);
    } catch (error) {
        res.status(500).send('Failed to collect metrics');
    }
});

// 2. System Health & Infrastructure
monitoringRouter.get('/dashboard', MonitoringController.getDashboard);
monitoringRouter.get('/health', MonitoringController.getSystemHealth);
monitoringRouter.get('/database', MonitoringController.getDatabaseStats);
monitoringRouter.get('/jobs', MonitoringController.getJobQueueStats);
monitoringRouter.get('/platform', MonitoringController.getInfrastructureStats);

// 3. Logs
monitoringRouter.get('/logs', MonitoringController.getLogs);
monitoringRouter.delete('/logs', MonitoringController.clearLogs);

export default monitoringRouter;