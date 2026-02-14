import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { AnalyticsController } from './analytics.controller';
import { getAnalyticsValidation } from './analytics.validations';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.get('/', getAnalyticsValidation, ValidationMiddleware.validate, AnalyticsController.getAnalytics);
router.get('/entries', getAnalyticsValidation, ValidationMiddleware.validate, AnalyticsController.getEntryAnalytics);
router.get('/media', getAnalyticsValidation, ValidationMiddleware.validate, AnalyticsController.getMediaAnalytics);
router.get('/graph', AnalyticsController.getGraphData);

export default router;
