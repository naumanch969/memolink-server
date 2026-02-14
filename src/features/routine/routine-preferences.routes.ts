import { Router } from 'express';
import { validationMiddleware } from '../../core/middleware/validation.middleware';
import { RoutineController } from './routine.controller';
import { updateUserRoutinePreferencesValidation } from './routine.validations';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.get('/', RoutineController.getUserRoutinePreferences);

router.patch(
    '/',
    updateUserRoutinePreferencesValidation,
    validationMiddleware,
    RoutineController.updateUserRoutinePreferences
);

export default router;
