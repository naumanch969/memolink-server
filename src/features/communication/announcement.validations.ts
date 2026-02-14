import { body, param } from 'express-validator';

export const createAnnouncementValidation = [
    body('title').notEmpty().withMessage('Title is required').isString().trim(),
    body('content').notEmpty().withMessage('Content is required').isString().trim(),
    body('type').optional().isIn(['info', 'warning', 'success', 'critical']),
    body('targetVersion').optional().isString().trim(),
];

export const updateAnnouncementValidation = [
    param('id').isMongoId().withMessage('Invalid announcement ID'),
    body('title').optional().isString().trim(),
    body('content').optional().isString().trim(),
    body('isActive').optional().isBoolean(),
];

export const announcementIdValidation = [
    param('id').isMongoId().withMessage('Invalid announcement ID'),
];
