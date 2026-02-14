import { Router } from 'express';
import { GoalController } from './goal.controller';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.post('/', GoalController.create);
router.get('/', GoalController.list);
router.get('/:id', GoalController.getOne);
router.patch('/:id', GoalController.update);
router.delete('/:id', GoalController.delete);
router.post('/:id/progress', GoalController.updateProgress);

export default router;
