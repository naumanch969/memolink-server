import { Router } from 'express';
import { validationMiddleware } from '../../core/middleware/validation.middleware';
import { RoutineController } from './routine.controller';
import { createRoutineLogValidation, getRoutineLogsValidation, logIdValidation, updateRoutineLogValidation, } from './routine.validations';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(AuthMiddleware.authenticate);

router.post('/', createRoutineLogValidation, validationMiddleware, RoutineController.createOrUpdateRoutineLog);

router.get('/', getRoutineLogsValidation, validationMiddleware, RoutineController.getRoutineLogs);

router.patch('/:id', logIdValidation, updateRoutineLogValidation, validationMiddleware, RoutineController.updateRoutineLog);

router.delete('/:id', logIdValidation, validationMiddleware, RoutineController.deleteRoutineLog);

export default router;
