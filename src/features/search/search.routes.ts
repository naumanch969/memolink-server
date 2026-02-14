import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { SearchController } from './search.controller';
import { globalSearchValidation } from './search.validations';

const router = Router();

router.use(AuthMiddleware.authenticate);

// Global Search
router.get('/global', globalSearchValidation, ValidationMiddleware.validate, SearchController.globalSearch);

export default router;
