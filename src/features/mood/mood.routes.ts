import { Router } from 'express';
import { authenticate } from '../../core/middleware/authMiddleware';
import { MoodController } from './mood.controller';

const router = Router();

router.use(authenticate);

router.get('/', MoodController.list);
router.post('/', MoodController.upsert);

export default router;
