import { body, param } from 'express-validator';

export const createWidgetValidation = [
    body('type')
        .notEmpty().withMessage('Widget type is required')
        .isIn(['tasks', 'notes', 'calendar', 'custom']).withMessage('Invalid widget type'),
    body('title')
        .notEmpty().withMessage('Widget title is required')
        .isString().withMessage('Widget title must be a string')
        .trim()
        .isLength({ max: 100 }).withMessage('Title cannot exceed 100 characters'),
    body('data').optional().isObject(),
    body('order').optional().isInt().withMessage('Order must be an integer'),
];

export const updateWidgetValidation = [
    param('id').isMongoId().withMessage('Invalid widget ID'),
    body('title').optional().isString().trim().isLength({ max: 100 }),
    body('data').optional().isObject(),
    body('order').optional().isInt(),
    body('group').optional().isString().trim(),
    body('isPinned').optional().isBoolean(),
];

export const widgetIdValidation = [
    param('id').isMongoId().withMessage('Invalid widget ID'),
];

export const reorderWidgetsValidation = [
    body('widgetIds').isArray().withMessage('widgetIds must be an array'),
    body('widgetIds.*').isMongoId().withMessage('Each ID must be a valid MongoID'),
];
