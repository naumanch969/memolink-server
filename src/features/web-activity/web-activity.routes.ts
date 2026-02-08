import { Router } from 'express';
import { authenticate } from '../../core/middleware/authMiddleware';
import { WebActivityController } from './web-activity.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Activity routes
router.post('/sync', WebActivityController.sync);
router.get('/today', WebActivityController.getToday);
router.get('/range', WebActivityController.getRange);
router.get('/weekly', WebActivityController.getWeekly);
router.get('/monthly', WebActivityController.getMonthly);

// Custom categorization
router.get('/definitions', WebActivityController.getDefinitions);
router.post('/definitions', WebActivityController.updateDefinitions);

// Domain limits
router.put('/limits', WebActivityController.upsertLimit);
router.delete('/limits/:domain', WebActivityController.removeLimit);
router.get('/limits/check', WebActivityController.checkLimits);

export default router;
