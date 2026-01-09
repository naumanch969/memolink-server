import { Router } from 'express';
import { goalController } from './goal.controller';
import { authenticate } from '../../core/middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.post('/', goalController.create);
router.get('/', goalController.list);
router.get('/:id', goalController.getOne);
router.patch('/:id', goalController.update);
router.delete('/:id', goalController.delete);
router.post('/:id/progress', goalController.updateProgress);

export default router;
