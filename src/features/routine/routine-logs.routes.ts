import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { RoutineController } from './routine.controller';
import { createRoutineLogValidation, getRoutineLogsValidation, logIdValidation, updateRoutineLogValidation, } from './routine.validations';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';

const router = Router();

// All routes require authentication
router.use(AuthMiddleware.authenticate);

router.post('/', createRoutineLogValidation, ValidationMiddleware.validate, RoutineController.createOrUpdateRoutineLog);

router.get('/', getRoutineLogsValidation, ValidationMiddleware.validate, RoutineController.getRoutineLogs);

router.patch('/:id', logIdValidation, updateRoutineLogValidation, ValidationMiddleware.validate, RoutineController.updateRoutineLog);

router.delete('/:id', logIdValidation, ValidationMiddleware.validate, RoutineController.deleteRoutineLog);

export default router;
