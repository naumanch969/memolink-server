import { Router } from 'express';
import { ChallengeController } from './challenge.controller';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

// All challenge routes are protected
router.use(AuthMiddleware.authenticate);

router.post('/', ChallengeController.create);
router.get('/active', ChallengeController.listActive);
router.post('/log', ChallengeController.logDay);

export default router;
