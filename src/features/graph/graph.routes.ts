import { Router } from 'express';
import { GraphController } from './graph.controller';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.get('/', GraphController.getGraph);

// Integrity Routes
router.post('/edges/:id/refute', GraphController.refuteEdge);
router.post('/edges/:id/resolve', GraphController.resolveProposal);
router.post('/repair', GraphController.repairGraph);

export default router;
