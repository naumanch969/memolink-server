import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { RateLimitMiddleware } from '../../core/middleware/rate-limit.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { EnrichmentController } from './enrichment.controller';
import { cleanTextValidation } from './enrichment.validations';

const router = Router();

// Protect all enrichment routes
router.use(AuthMiddleware.authenticate);

// Manually trigger re-enrichment for an entry or the whole library
router.post(
    '/sync',
    RateLimitMiddleware.limit({ zone: 'sync', maxRequests: 5, windowMs: 5 * 60 * 1000 }),
    EnrichmentController.sync
);

router.post(
    '/clean',
    RateLimitMiddleware.limit({ zone: 'ai', maxRequests: 10, windowMs: 60 * 1000 }),
    cleanTextValidation,
    ValidationMiddleware.validate,
    EnrichmentController.cleanText
);

export default router;
