import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { GoalController } from './goal.controller';
import { createGoalValidation, goalIdValidation, updateGoalValidation, updateProgressValidation } from './goal.validations';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.post('/', createGoalValidation, ValidationMiddleware.validate, GoalController.create);
router.get('/', GoalController.list);
router.get('/:id', goalIdValidation, ValidationMiddleware.validate, GoalController.getOne);
router.patch('/:id', updateGoalValidation, ValidationMiddleware.validate, GoalController.update);
router.delete('/:id', goalIdValidation, ValidationMiddleware.validate, GoalController.delete);
router.post('/:id/progress', updateProgressValidation, ValidationMiddleware.validate, GoalController.updateProgress);

export default router;
