import { body, query } from 'express-validator';

export const syncActivityValidation = [
    body('syncId').notEmpty().withMessage('syncId is required'),
    body('date').isISO8601().withMessage('Invalid date format'),
    body('totalSeconds').isInt({ min: 0 }),
    body('domainMap').isObject().withMessage('domainMap must be an object'),
];

export const getActivityRangeValidation = [
    query('startDate').isISO8601().withMessage('startDate is required'),
    query('endDate').isISO8601().withMessage('endDate is required'),
];

export const upsertLimitValidation = [
    body('domain').notEmpty().withMessage('Domain is required').isString(),
    body('dailyLimitMinutes').isInt({ min: 1 }).withMessage('dailyLimitMinutes must be at least 1'),
];
