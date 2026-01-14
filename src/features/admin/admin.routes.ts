import { Router } from 'express';
import { adminController } from './admin.controller';
import { authenticate, authorize } from '../../core/middleware/authMiddleware';
import { USER_ROLES } from '../../shared/constants';

const router = Router();

// Protect all admin routes
router.use(authenticate);
router.use(authorize(USER_ROLES.ADMIN));

// Backup routes
router.get('/backups', adminController.getBackups);
router.get('/backups/runs', adminController.getBackupRuns);
router.post('/backups/trigger', adminController.triggerBackup);

export default router;
