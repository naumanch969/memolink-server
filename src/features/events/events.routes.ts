import { Router } from 'express';
import { EventsController } from './events.controller';
import { authenticate } from '../../core/middleware/authMiddleware';

const router = Router();

// POST /api/events - Ingest specific batch of client events
router.post('/', authenticate, EventsController.ingest);

export default router;
