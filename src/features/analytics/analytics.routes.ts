import { Router } from 'express';
import { AnalyticsController } from './analytics.controller';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.get('/', AnalyticsController.getAnalytics);
router.get('/entries', AnalyticsController.getEntryAnalytics);
router.get('/media', AnalyticsController.getMediaAnalytics);
router.get('/graph', AnalyticsController.getGraphData);

export default router;
