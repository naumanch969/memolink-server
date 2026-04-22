import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { FileUploadMiddleware } from '../../core/middleware/upload.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { captureController } from './capture.controller';
import { captureEntryValidation, capturWebValidation, capturWhatsAppValidation } from './capture.validations';

const router = Router();

// All capture routes require authentication
router.use(AuthMiddleware.authenticate);

// 1. ACTIVE: Text/Voice/Manual Entry
// Supports both JSON (text) and multipart/form-data (audio + files)
router.post(
    '/entry',
    FileUploadMiddleware.uploadFields([
        { name: 'audio', maxCount: 1 },
        { name: 'file_0', maxCount: 1 },
        { name: 'file_1', maxCount: 1 },
        { name: 'file_2', maxCount: 1 },
        { name: 'file_3', maxCount: 1 },
        { name: 'file_4', maxCount: 1 },
    ]),
    captureEntryValidation,
    ValidationMiddleware.validate,
    captureController.captureEntry,
);

// 2. PASSIVE: Web Activity Sync (Browser Extension)
router.post('/web', capturWebValidation, ValidationMiddleware.validate, captureController.captureWeb);

// 3. SOCIAL/WEBHOOK: WhatsApp Bridge
router.post('/whatsapp', capturWhatsAppValidation, ValidationMiddleware.validate, captureController.captureWhatsApp);


export default router;
