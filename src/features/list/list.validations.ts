import { body, param } from 'express-validator';

export const createListValidation = [
    body('type')
        .notEmpty().withMessage('List type is required')
        .isIn(['tasks', 'notes', 'calendar', 'custom']).withMessage('Invalid list type'),
    body('title')
        .notEmpty().withMessage('List title is required')
        .isString().withMessage('List title must be a string')
        .trim()
        .isLength({ max: 100 }).withMessage('Title cannot exceed 100 characters'),
    body('data').optional().isObject(),
    body('order').optional().isInt().withMessage('Order must be an integer'),
];

export const updateListValidation = [
    param('id').isMongoId().withMessage('Invalid list ID'),
    body('title').optional().isString().trim().isLength({ max: 100 }),
    body('data').optional().isObject(),
    body('order').optional().isInt(),
    body('group').optional().isString().trim(),
    body('isPinned').optional().isBoolean(),
];

export const listIdValidation = [
    param('id').isMongoId().withMessage('Invalid list ID'),
];

export const reorderListsValidation = [
    body('listIds').isArray().withMessage('listIds must be an array'),
    body('listIds.*').isMongoId().withMessage('Each ID must be a valid MongoID'),
];
