import { Router } from 'express';
import { emailController } from './email.controller';
import { emailValidations } from './email.validations';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { USER_ROLES } from '../../shared/constants';

const router = Router();

// Webhook for email status tracking (ensure it's not protected by auth)
router.post('/webhook/resend', emailController.handleResendWebhook);


router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.authorize(USER_ROLES.ADMIN));

// Logs
router.get('/logs', emailController.getLogs);

// Templates
router.get('/templates', emailController.getTemplates);
router.post('/templates', emailValidations.createTemplate, ValidationMiddleware.validate, emailController.createTemplate);
router.get('/templates/:id', emailValidations.templateIdParam, ValidationMiddleware.validate, emailController.getTemplateById);
router.patch('/templates/:id', emailValidations.updateTemplate, ValidationMiddleware.validate, emailController.updateTemplate);
router.delete('/templates/:id', emailValidations.templateIdParam, ValidationMiddleware.validate, emailController.deleteTemplate);

// Custom one-off email sending
router.post('/send-custom', emailValidations.sendCustomEmail, ValidationMiddleware.validate, emailController.sendCustomEmail);

export default router;
