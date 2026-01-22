import { Router } from 'express';
import { authenticate, authorize } from '../../core/middleware/authMiddleware';
import { USER_ROLES } from '../../shared/constants';
import { adminController } from './admin.controller';

const router = Router();

// Protect all admin routes
router.use(authenticate);
router.use(authorize(USER_ROLES.ADMIN));

// Dashboard
router.get('/dashboard', adminController.getDashboardOverview);

// Analytics
router.get('/analytics/users', adminController.getAnalyticsUserGrowth);
router.get('/analytics/platform', adminController.getAnalyticsPlatform);
router.get('/analytics/features', adminController.getAnalyticsFeatures);
router.get('/analytics/accounts', adminController.getAnalyticsUserAccounts);
router.get('/analytics/active-users', adminController.getAnalyticsActiveUsers);

// Monitoring
router.get('/monitoring/system', adminController.getSystemHealth);
router.get('/monitoring/database', adminController.getDatabaseStats);
router.get('/monitoring/jobs', adminController.getJobQueueStats);
router.get('/monitoring/logs', adminController.getLogs);
router.delete('/monitoring/logs', adminController.clearLogs);



// User Management
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserDetails);
router.patch('/users/:id', adminController.updateUser);
router.patch('/users/:id/deactivate', adminController.deactivateUser);
router.patch('/users/:id/reactivate', adminController.reactivateUser);
router.delete('/users/:id', adminController.deleteUser);

// System Configuration
router.get('/configuration', adminController.getSystemConfigs);
router.patch('/configuration/:key', adminController.updateSystemConfig);

// Backups
router.get('/backups', adminController.getBackups);
router.get('/backups/runs', adminController.getBackupRuns);
router.post('/backups/trigger', adminController.triggerBackup);

export default router;
