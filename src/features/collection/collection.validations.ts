import { body, param } from 'express-validator';

export const createCollectionValidation = [
    body('name')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Collection name must be between 1 and 100 characters'),

    body('color')
        .optional()
        .matches(/^#[0-9A-F]{6}$/i)
        .withMessage('Color must be a valid hex color (e.g., #FF5733)'),

    body('icon')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Icon cannot exceed 50 characters'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 300 })
        .withMessage('Description cannot exceed 300 characters'),
];

export const updateCollectionValidation = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Collection name must be between 1 and 100 characters'),

    body('color')
        .optional()
        .matches(/^#[0-9A-F]{6}$/i)
        .withMessage('Color must be a valid hex color (e.g., #FF5733)'),

    body('icon')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Icon cannot exceed 50 characters'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 300 })
        .withMessage('Description cannot exceed 300 characters'),
];

export const collectionIdValidation = [
    param('id')
        .isMongoId()
        .withMessage('Invalid collection ID format'),
];
