import { Router } from 'express';
import { authenticate } from '../../core/middleware/authMiddleware';
import { GraphController } from './graph.controller';

const router = Router();

router.get('/', authenticate, GraphController.getGraph);

// Integrity Routes
router.post('/edges/:id/refute', authenticate, GraphController.refuteEdge);
router.post('/edges/:id/resolve', authenticate, GraphController.resolveProposal);
router.post('/repair', authenticate, GraphController.repairGraph);

export default router;
