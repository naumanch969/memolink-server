import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { WebActivityController } from './web-activity.controller';
import { getActivityRangeValidation, syncActivityValidation, upsertLimitValidation } from './web-activity.validations';

const router = Router();

// All routes require authentication
router.use(AuthMiddleware.authenticate);

// Activity routes
router.post('/sync', syncActivityValidation, ValidationMiddleware.validate, WebActivityController.sync);
router.get('/today', WebActivityController.getToday);
router.get('/range', getActivityRangeValidation, ValidationMiddleware.validate, WebActivityController.getRange);
router.get('/weekly', WebActivityController.getWeekly);
router.get('/monthly', WebActivityController.getMonthly);

// Custom categorization
router.get('/definitions', WebActivityController.getDefinitions);
router.post('/definitions', WebActivityController.updateDefinitions);

// Domain limits
router.put('/limits', upsertLimitValidation, ValidationMiddleware.validate, WebActivityController.upsertLimit);
router.delete('/limits/:domain', WebActivityController.removeLimit);
router.get('/limits/check', WebActivityController.checkLimits);

export default router;
