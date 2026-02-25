import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { StorageController } from './storage.controller';

const router = Router();

// All routes require authentication
router.use(AuthMiddleware.authenticate);

// GET /api/storage - Get storage stats
router.get('/', StorageController.getStorageStats);

// GET /api/storage/breakdown - Get storage breakdown by type
router.get('/breakdown', StorageController.getStorageBreakdown);

// POST /api/storage/sync - Recalculate storage usage
router.post('/sync', StorageController.syncStorage);

// GET /api/storage/orphans - Find orphaned media
router.get('/orphans', StorageController.getOrphanedMedia);

// GET /api/storage/suggestions - Get cleanup suggestions
router.get('/suggestions', StorageController.getCleanupSuggestions);

export default router;
