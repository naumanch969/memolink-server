import { Router } from 'express';
import { GoalController } from './goal.controller';
import { authenticate } from '../../core/middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.post('/', GoalController.createGoal);
router.get('/', GoalController.getGoals);
router.get('/:id', GoalController.getGoalById);
router.put('/:id', GoalController.updateGoal);
router.delete('/:id', GoalController.deleteGoal);

export default router;
