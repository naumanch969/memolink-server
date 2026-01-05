import { Router } from 'express';
import { RoutineController } from './routine.controller';
import { authenticate } from '../../core/middleware/authMiddleware';
import { createRoutineLogValidation, updateRoutineLogValidation, logIdValidation, getRoutineLogsValidation, } from './routine.validations';
import { validationMiddleware } from '../../core/middleware/validationMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// ROUTINE LOG ROUTES
// ============================================

router.post('/', createRoutineLogValidation, validationMiddleware, RoutineController.createOrUpdateRoutineLog);

router.get('/', getRoutineLogsValidation, validationMiddleware, RoutineController.getRoutineLogs);

router.patch('/:id', logIdValidation, updateRoutineLogValidation, validationMiddleware, RoutineController.updateRoutineLog);

router.delete('/:id', logIdValidation, validationMiddleware, RoutineController.deleteRoutineLog);

export default router;
