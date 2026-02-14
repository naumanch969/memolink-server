import { body, query } from 'express-validator';

export const upsertMoodValidation = [
    body('date')
        .notEmpty().withMessage('Date is required')
        .isISO8601().withMessage('Invalid date format')
        .toDate(),
    body('score')
        .notEmpty().withMessage('Score is required')
        .isInt({ min: 1, max: 5 }).withMessage('Score must be an integer between 1 and 5'),
    body('note')
        .optional()
        .isString().withMessage('Note must be a string')
        .trim()
        .isLength({ max: 500 }).withMessage('Note cannot exceed 500 characters'),
];

export const listMoodsValidation = [
    query('dateFrom').optional().isISO8601().withMessage('Invalid dateFrom format'),
    query('dateTo').optional().isISO8601().withMessage('Invalid dateTo format'),
];
