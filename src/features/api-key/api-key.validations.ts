import { body, param } from 'express-validator';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';

export const validateCreateApiKey = [
    body('name')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ max: 100 })
        .withMessage('Name cannot exceed 100 characters'),
    body('expiresInDays')
        .optional()
        .isInt({ min: 1, max: 365 })
        .withMessage('Expiration must be between 1 and 365 days'),
    ValidationMiddleware.validate
];

export const validateRevokeApiKey = [
    param('id')
        .isMongoId()
        .withMessage('Invalid API Key ID'),
    ValidationMiddleware.validate
];
