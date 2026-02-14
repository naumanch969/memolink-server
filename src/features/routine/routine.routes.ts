import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { RoutineController } from './routine.controller';
import { createRoutineTemplateValidation, getRoutineAnalyticsValidation, getRoutineStatsValidation, reorderRoutinesValidation, routineIdValidation, updateRoutineTemplateValidation } from './routine.validations';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';

const router = Router();

// All routes require authentication
router.use(AuthMiddleware.authenticate);



// Analytics (must be before /:id routes)
router.get('/analytics', getRoutineAnalyticsValidation, ValidationMiddleware.validate, RoutineController.getRoutineAnalytics);

// Reorder routines
router.patch('/reorder', reorderRoutinesValidation, ValidationMiddleware.validate, RoutineController.reorderRoutineTemplates);

// CRUD operations
router.post('/', createRoutineTemplateValidation, ValidationMiddleware.validate, RoutineController.createRoutineTemplate);
router.get('/', RoutineController.getRoutineTemplates);
router.get('/:id/stats', routineIdValidation, getRoutineStatsValidation, ValidationMiddleware.validate, RoutineController.getRoutineStats);
router.get('/:id', routineIdValidation, ValidationMiddleware.validate, RoutineController.getRoutineTemplateById);
router.patch('/:id', routineIdValidation, updateRoutineTemplateValidation, ValidationMiddleware.validate, RoutineController.updateRoutineTemplate);
router.patch('/:id/pause', routineIdValidation, ValidationMiddleware.validate, RoutineController.pauseRoutineTemplate);
router.patch('/:id/archive', routineIdValidation, ValidationMiddleware.validate, RoutineController.archiveRoutineTemplate);
router.patch('/:id/unarchive', routineIdValidation, ValidationMiddleware.validate, RoutineController.unarchiveRoutineTemplate);
router.delete('/:id', routineIdValidation, ValidationMiddleware.validate, RoutineController.deleteRoutineTemplate);

export default router;
