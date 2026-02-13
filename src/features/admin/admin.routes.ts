import { Router } from 'express';
import { authenticate, authorize } from '../../core/middleware/authMiddleware';
import { USER_ROLES } from '../../shared/constants';
import { analyticsAdminRouter } from '../analytics/analytics.admin.routes';
import { llmUsageAdminRouter } from '../llm-usage/llm-usage.routes';
import { usersAdminRouter } from '../users/users.admin.routes';
import { AdminController } from './admin.controller';
import { monitoringRouter } from '../monitoring/monitoring.routes';

const router = Router();

// Protect all admin routes
router.use(authenticate);
router.use(authorize(USER_ROLES.ADMIN));

// Dashboard & Analytics
router.use('/analytics', analyticsAdminRouter);

// Monitoring
router.use('/monitoring', monitoringRouter);

// User Management
router.use('/users', usersAdminRouter);

// System Configuration
router.get('/configuration', AdminController.getSystemConfigs);
router.patch('/configuration/:key', AdminController.updateSystemConfig);

// Backups
router.get('/backups', AdminController.getBackups);
router.get('/backups/runs', AdminController.getBackupRuns);
router.post('/backups/trigger', AdminController.triggerBackup);

// Costs
router.use('/costs', llmUsageAdminRouter);

export default router;
 