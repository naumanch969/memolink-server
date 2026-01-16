import { Router } from 'express';
import { authenticate } from '../../core/middleware/authMiddleware';
import { AnalyticsController } from './analytics.controller';

const router = Router();

router.use(authenticate);

router.get('/', AnalyticsController.getAnalytics);
router.get('/entries', AnalyticsController.getEntryAnalytics);
router.get('/media', AnalyticsController.getMediaAnalytics);
router.get('/graph', AnalyticsController.getGraphData);

export default router;
