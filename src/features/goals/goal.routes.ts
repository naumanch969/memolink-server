import { Router } from 'express';
import { GoalController } from './goal.controller';
import { authenticate } from '../../core/middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Checkpoint routes (must be before /:id routes to avoid collision)
router.post('/checkpoints', GoalController.createCheckpoint);
router.put('/checkpoints/:id', GoalController.updateCheckpoint);
router.delete('/checkpoints/:id', GoalController.deleteCheckpoint);

// Goal routes
router.post('/', GoalController.createGoal);
router.get('/', GoalController.getGoals);
router.get('/:id', GoalController.getGoalById);
router.put('/:id', GoalController.updateGoal);
router.delete('/:id', GoalController.deleteGoal);

export default router;
