import { Router } from 'express';
import { SearchController } from './search.controller';
import { authenticate } from '../../core/middleware/authMiddleware';

const router = Router();

// Global Search
router.get('/global', authenticate, SearchController.globalSearch);

export default router;
