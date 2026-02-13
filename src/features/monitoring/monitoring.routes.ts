import { Router } from 'express';
import { MonitoringController } from './monitoring.controller';

const monitoringRouter = Router();

// System Health & Metrics
monitoringRouter.get('/system', MonitoringController.getSystemHealth);
monitoringRouter.get('/database', MonitoringController.getDatabaseStats);
monitoringRouter.get('/jobs', MonitoringController.getJobQueueStats);

// Logs
monitoringRouter.get('/logs', MonitoringController.getLogs);
monitoringRouter.delete('/logs', MonitoringController.clearLogs);

export { monitoringRouter };
