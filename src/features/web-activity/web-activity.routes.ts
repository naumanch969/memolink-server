import { Router } from 'express';
import { authenticate } from '../../core/middleware/authMiddleware';
import { webActivityController } from './web-activity.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Activity routes
router.post('/sync', webActivityController.sync);
router.get('/today', webActivityController.getToday);

export default router;
