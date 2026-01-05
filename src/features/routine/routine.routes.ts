import { Router } from 'express';
import { RoutineController } from './routine.controller';
import { authenticate } from '../../core/middleware/authMiddleware';
import {
    createRoutineTemplateValidation,
    updateRoutineTemplateValidation,
    routineIdValidation,
    reorderRoutinesValidation,
    createRoutineLogValidation,
    updateRoutineLogValidation,
    logIdValidation,
    getRoutineLogsValidation,
    getRoutineStatsValidation,
    getRoutineAnalyticsValidation,
    updateUserRoutinePreferencesValidation,
} from './routine.validations';
import { validationMiddleware } from '../../core/middleware/validationMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

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
