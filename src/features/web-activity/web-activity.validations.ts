import { body, query } from 'express-validator';

export const syncActivityValidation = [
    body('syncId').notEmpty().withMessage('syncId is required'),
    body('date').isISO8601().withMessage('Invalid date format'),
    body('totalSeconds').isInt({ min: 0 }),
    body('domainMap').isObject().withMessage('domainMap must be an object'),
];

export const getActivityRangeValidation = [
    query('from').isISO8601().withMessage('from date is required (YYYY-MM-DD)'),
    query('to').isISO8601().withMessage('to date is required (YYYY-MM-DD)'),
];

export const upsertLimitValidation = [
    body('domain').notEmpty().withMessage('Domain is required').isString(),
    body('dailyLimitMinutes').isInt({ min: 1 }).withMessage('dailyLimitMinutes must be at least 1'),
];
