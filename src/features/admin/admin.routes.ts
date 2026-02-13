import { Router } from 'express';
import { authenticate, authorize } from '../../core/middleware/authMiddleware';
import { USER_ROLES } from '../../shared/constants';
import { AdminController } from './admin.controller';
import { llmUsageAdminRouter } from '../llm-usage/llm-usage.routes';

const router = Router();

// Protect all admin routes
router.use(authenticate);
router.use(authorize(USER_ROLES.ADMIN));

// Dashboard
router.get('/dashboard', AdminController.getDashboardOverview);

// Analytics
router.get('/analytics/users', AdminController.getAnalyticsUserGrowth);
router.get('/analytics/platform', AdminController.getAnalyticsPlatform);
router.get('/analytics/features', AdminController.getAnalyticsFeatures);
router.get('/analytics/accounts', AdminController.getAnalyticsUserAccounts);
router.get('/analytics/active-users', AdminController.getAnalyticsActiveUsers);
router.get('/analytics/content-growth', AdminController.getAnalyticsContentGrowth);
router.get('/analytics/feature-breakdown', AdminController.getAnalyticsFeatureBreakdown);
router.get('/analytics/retention', AdminController.getAnalyticsRetention);

// Monitoring
router.get('/monitoring/system', AdminController.getSystemHealth);
router.get('/monitoring/database', AdminController.getDatabaseStats);
router.get('/monitoring/jobs', AdminController.getJobQueueStats);
router.get('/monitoring/logs', AdminController.getLogs);
router.delete('/monitoring/logs', AdminController.clearLogs);

// User Management
router.get('/users', AdminController.getUsers);
router.get('/users/:id', AdminController.getUserDetails);
router.patch('/users/:id', AdminController.updateUser);
router.patch('/users/:id/deactivate', AdminController.deactivateUser);
router.patch('/users/:id/reactivate', AdminController.reactivateUser);
router.delete('/users/:id', AdminController.deleteUser);

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
