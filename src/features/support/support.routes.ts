import { Router } from 'express';
import { SupportController } from './support.controller';
import { sendSupportEmailValidation } from './support.validation';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';

const router = Router();

router.post('/feedback', sendSupportEmailValidation, ValidationMiddleware.validate, SupportController.sendFeedback);

export default router;
