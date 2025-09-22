import { Router } from 'express';
import { HabitController } from './habit.controller';
import { authenticate } from '../../core/middleware/authMiddleware';
import { 
  createHabitValidation,
  updateHabitValidation,
  habitIdValidation,
  createHabitLogValidation,
  updateHabitLogValidation
} from './habit.validations';
import { validationMiddleware } from '../../core/middleware/validationMiddleware';

const router = Router();

router.use(authenticate);

// Habit routes
router.post('/', createHabitValidation, validationMiddleware, HabitController.createHabit);
router.get('/', HabitController.getUserHabits);
router.get('/stats', HabitController.getHabitStats);
router.get('/:id', habitIdValidation, validationMiddleware, HabitController.getHabitById);
router.get('/:id/streak', habitIdValidation, validationMiddleware, HabitController.getHabitStreak);
router.put('/:id', habitIdValidation, updateHabitValidation, validationMiddleware, HabitController.updateHabit);
router.delete('/:id', habitIdValidation, validationMiddleware, HabitController.deleteHabit);

// Habit log routes
router.post('/logs', createHabitLogValidation, validationMiddleware, HabitController.createHabitLog);
router.put('/logs/:id', updateHabitLogValidation, validationMiddleware, HabitController.updateHabitLog);

export default router;
