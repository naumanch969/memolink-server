import { Router } from 'express';
import { validationMiddleware } from '../../core/middleware/validation.middleware';
import { RoutineController } from './routine.controller';
import { createRoutineTemplateValidation, getRoutineAnalyticsValidation, getRoutineStatsValidation, reorderRoutinesValidation, routineIdValidation, updateRoutineTemplateValidation } from './routine.validations';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(AuthMiddleware.authenticate);

// ============================================
// ROUTINE TEMPLATE ROUTES
// ============================================

// Analytics (must be before /:id routes)
router.get('/analytics', getRoutineAnalyticsValidation, validationMiddleware, RoutineController.getRoutineAnalytics);

// Reorder routines
router.patch('/reorder', reorderRoutinesValidation, validationMiddleware, RoutineController.reorderRoutineTemplates);

// CRUD operations
router.post('/', createRoutineTemplateValidation, validationMiddleware, RoutineController.createRoutineTemplate);

router.get('/', RoutineController.getRoutineTemplates);

router.get('/:id/stats', routineIdValidation, getRoutineStatsValidation, validationMiddleware, RoutineController.getRoutineStats);

router.get('/:id', routineIdValidation, validationMiddleware, RoutineController.getRoutineTemplateById);

router.patch('/:id', routineIdValidation, updateRoutineTemplateValidation, validationMiddleware, RoutineController.updateRoutineTemplate);

router.patch('/:id/pause', routineIdValidation, validationMiddleware, RoutineController.pauseRoutineTemplate);

router.patch('/:id/archive', routineIdValidation, validationMiddleware, RoutineController.archiveRoutineTemplate);

router.patch('/:id/unarchive', routineIdValidation, validationMiddleware, RoutineController.unarchiveRoutineTemplate);

router.delete('/:id', routineIdValidation, validationMiddleware, RoutineController.deleteRoutineTemplate);

export default router;
