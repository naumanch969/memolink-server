import { body } from 'express-validator';

// 1. ACTIVE: Manual Human Intent
export const ingestEntryValidation = [
    body('content').optional().isString(),
    body('type').optional().isString(),
    body('date').optional().isISO8601(),
    body('tags').optional().isArray(),
    body('mentions').optional().isArray(),
    body('collectionId').optional().isMongoId(),
];

// 2. PASSIVE: Web Activity Sync
export const ingestWebValidation = [
    body('syncId').notEmpty().withMessage('syncId is required'),
    body('date').isISO8601().withMessage('Invalid date format'),
    body('totalSeconds').isInt({ min: 0 }),
    body('domainMap').isObject().withMessage('domainMap must be an object'),
];

// 3. SOCIAL: WhatsApp
export const ingestWhatsAppValidation = [
    body('from').notEmpty(),
    body('body').notEmpty(),
    body('senderName').optional().isString(),
    body('isVoice').optional().isBoolean(),
    body('mediaUrl').optional().isURL(),
];

// 4. BEHAVIORAL: App Activity
export const ingestActivityValidation = [
    body('platform').optional().isIn(['mobile', 'desktop']),
    // Logic handles both single object and array, we just check existence
    body().custom((value) => {
        if (!value || typeof value !== 'object') throw new Error('Invalid payload');
        return true;
    })
];

// Legacy / Universal
export const captureValidation = [
    body('source').isIn(['active-entry', 'web-extension', 'whatsapp', 'mobile-app', 'desktop-app']),
    body('payload').notEmpty().withMessage('payload is required')
];
