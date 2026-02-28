import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ApiKeyController } from './api-key.controller';
import { validateCreateApiKey, validateRevokeApiKey } from './api-key.validations';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.post('/', validateCreateApiKey, ApiKeyController.createApiKey);
router.get('/', ApiKeyController.listApiKeys);
router.delete('/:id', validateRevokeApiKey, ApiKeyController.revokeApiKey);

export default router;
