import { param, query } from 'express-validator';

export const getNotificationsValidation = [
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
    query('unreadOnly').optional().isBoolean().toBoolean(),
];

export const notificationIdValidation = [
    param('id').isMongoId().withMessage('Invalid notification ID'),
];
