import { Router } from 'express';
import { authenticate } from '../../core/middleware/authMiddleware';
import { GoalController } from './goal.controller';

const router = Router();

router.use(authenticate);

router.post('/', GoalController.create);
router.get('/', GoalController.list);
router.get('/:id', GoalController.getOne);
router.patch('/:id', GoalController.update);
router.delete('/:id', GoalController.delete);
router.post('/:id/progress', GoalController.updateProgress);

export default router;
