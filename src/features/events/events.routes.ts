import { Router } from 'express';
import { EventsController } from './events.controller';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.post('/', EventsController.ingest);

export default router;
