
import { Router } from 'express';
import { authenticate } from '../../core/middleware/authMiddleware';
import { InsightsController } from './insights.controller';

const router = Router();

router.use(authenticate);

router.get('/dashboard', InsightsController.getDashboard);
router.post('/generate', InsightsController.generate); // For manual trigger/testing

export default router;
