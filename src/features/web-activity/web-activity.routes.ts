import { Router } from 'express';
import { authenticate } from '../../core/middleware/authMiddleware';
import { WebActivityController } from './web-activity.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Activity routes
router.post('/sync', WebActivityController.sync);
router.get('/today', WebActivityController.getToday);

export default router;
