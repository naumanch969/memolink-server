import { body } from 'express-validator';

// 1. ACTIVE: Text/Voice/Manual Entry
export const captureEntryValidation = [
    body('content').optional().isString(),
    body('type').optional().isString(),
    body('date').optional().isISO8601(),
    body('tags').optional().isArray(),
    body('mentions').optional().isArray(),
    body('collectionId').optional().isMongoId(),
];

// 2. PASSIVE: Web Activity Sync (Browser Extension)
export const capturWebValidation = [
    body('syncId').notEmpty().withMessage('syncId is required'),
    body('date').notEmpty().withMessage('date is required'),
    body('totalSeconds').isInt({ min: 0 }),
    body('productiveSeconds').optional().isInt({ min: 0 }),
    body('distractingSeconds').optional().isInt({ min: 0 }),
    body('domainMap').isObject().withMessage('domainMap must be an object'),
];

// 3. SOCIAL/WEBHOOK: WhatsApp Bridge
export const capturWhatsAppValidation = [
    body('from').notEmpty(),
    body('body').notEmpty(),
    body('senderName').optional().isString(),
    body('isVoice').optional().isBoolean(),
    body('mediaUrl').optional().isURL(),
    body('timestamp').optional(),
];
