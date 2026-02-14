import { Router } from 'express';
import { MoodController } from './mood.controller';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.get('/', MoodController.list);
router.post('/', MoodController.upsert);

export default router;
