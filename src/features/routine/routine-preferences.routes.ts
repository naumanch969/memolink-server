import { Router } from 'express';
import { RoutineController } from './routine.controller';
import { authenticate } from '../../core/middleware/authMiddleware';
import { updateUserRoutinePreferencesValidation } from './routine.validations';
import { validationMiddleware } from '../../core/middleware/validationMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// USER ROUTINE PREFERENCES ROUTES
// ============================================

router.get('/', RoutineController.getUserRoutinePreferences);

router.patch(
    '/',
    updateUserRoutinePreferencesValidation,
    validationMiddleware,
    RoutineController.updateUserRoutinePreferences
);

export default router;
