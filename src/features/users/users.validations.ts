import { body, param, query } from 'express-validator';

export const userIdValidation = [
    param('id').isMongoId().withMessage('Invalid user ID'),
];

export const listUsersValidation = [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
];

export const updateUserValidation = [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('role').optional().isIn(['user', 'admin', 'premium']),
    body('isActive').optional().isBoolean(),
];
