import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { captureController } from './capture.controller';
import { captureValidation, ingestActivityValidation, ingestEntryValidation, ingestWebValidation, ingestWhatsAppValidation } from './capture.validations';

const router = Router();

// All capture routes require authentication
router.use(AuthMiddleware.authenticate);

// 1. ACTIVE: Manual Human Intent
router.post('/entry', ingestEntryValidation, ValidationMiddleware.validate, captureController.captureEntry);

// 2. PASSIVE: Web Extension Sync
router.post('/web', ingestWebValidation, ValidationMiddleware.validate, captureController.captureWeb);

// 3. SOCIAL/WEBHOOK: WhatsApp Bridge
router.post('/whatsapp', ingestWhatsAppValidation, ValidationMiddleware.validate, captureController.captureWhatsApp);

// 4. BEHAVIORAL: App Tracker (Mobile/Desktop)
router.post('/activity', ingestActivityValidation, ValidationMiddleware.validate, captureController.captureActivity);

// 5. Support Universal Terminal
router.post('/', captureValidation, ValidationMiddleware.validate, captureController.capture);

export default router;
