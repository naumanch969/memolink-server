import { body, param } from 'express-validator';

export const emailValidations = {
    createTemplate: [
        body('name').notEmpty().withMessage('Template name is required').isString().isLength({ min: 3, max: 50 }).trim(),
        body('subject').notEmpty().withMessage('Subject is required').isString().isLength({ min: 3, max: 200 }).trim(),
        body('htmlBody').notEmpty().withMessage('HTML body is required').isString().isLength({ min: 10 }),
        body('textBody').optional().isString(),
        body('variables').optional().isArray(),
        body('description').optional().isString().trim(),
    ],

    updateTemplate: [
        param('id').isMongoId().withMessage('Invalid template ID'),
        body('name').optional().isString().isLength({ min: 3, max: 50 }).trim(),
        body('subject').optional().isString().isLength({ min: 3, max: 200 }).trim(),
        body('htmlBody').optional().isString().isLength({ min: 10 }),
        body('textBody').optional().isString(),
        body('variables').optional().isArray(),
        body('description').optional().isString().trim(),
        body('isActive').optional().isBoolean(),
    ],

    sendCustomEmail: [
        body('to').notEmpty().withMessage('Recipient email is required').isEmail().withMessage('Valid email is required'),
        body('subject').notEmpty().withMessage('Subject is required').isString().isLength({ min: 3, max: 200 }).trim(),
        body('html').notEmpty().withMessage('HTML content is required').isString().isLength({ min: 10 }),
        body('text').optional().isString(),
        body('userId').optional().isMongoId(),
        body('metadata').optional().isObject(),
    ],

    templateIdParam: [
        param('id').isMongoId().withMessage('Invalid template ID'),
    ]
};
