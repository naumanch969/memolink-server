import { Router } from 'express';
import { authenticate } from '../../core/middleware/authMiddleware';
import { GraphController } from './graph.controller';

const router = Router();

router.get('/', authenticate, GraphController.getGraph);

export default router;
