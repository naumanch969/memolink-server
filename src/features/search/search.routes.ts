import { Router } from 'express';
import { SearchController } from './search.controller';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.get('/global', SearchController.globalSearch);

export default router;
