import { Router } from 'express';
import { AnalyticsController } from './analytics.controller';
import { authenticate } from '../../core/middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', AnalyticsController.getAnalytics);
router.get('/entries', AnalyticsController.getEntryAnalytics);
router.get('/habits', AnalyticsController.getHabitAnalytics);
router.get('/media', AnalyticsController.getMediaAnalytics);

export default router;
