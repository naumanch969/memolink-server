import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { USER_ROLES } from '../../shared/constants';
import { analyticsAdminRouter } from '../analytics/analytics.admin.routes';
import { llmUsageAdminRouter } from '../llm-usage/llm-usage.routes';
import monitoringRouter from '../monitoring/monitoring.routes';
import { usersAdminRouter } from '../users/users.admin.routes';
import { AdminController } from './admin.controller';
import { updateConfigValidation } from './admin.validations';

const router = Router();

// Protect all admin routes
router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.authorize(USER_ROLES.ADMIN));

// Dashboard & Analytics
router.use('/analytics', analyticsAdminRouter);

// Monitoring
router.use('/monitoring', monitoringRouter);

// User Management
router.use('/users', usersAdminRouter);

// System Configuration
router.get('/configuration', AdminController.getSystemConfigs);
router.patch('/configuration/:key', updateConfigValidation, ValidationMiddleware.validate, AdminController.updateSystemConfig);

// Backups
router.get('/backups', AdminController.getBackups);
router.get('/backups/runs', AdminController.getBackupRuns);
router.post('/backups/trigger', AdminController.triggerBackup);

// Costs
router.use('/costs', llmUsageAdminRouter);

export default router;
