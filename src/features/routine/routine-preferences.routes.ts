import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { RoutineController } from './routine.controller';
import { updateUserRoutinePreferencesValidation } from './routine.validations';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.get('/', RoutineController.getUserRoutinePreferences);
router.patch('/', updateUserRoutinePreferencesValidation, ValidationMiddleware.validate, RoutineController.updateUserRoutinePreferences);

export default router;
