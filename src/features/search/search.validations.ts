import { query } from 'express-validator';

export const globalSearchValidation = [
    query('q').notEmpty().withMessage('Search query (q) is required').trim(),
    query('mode').optional().isIn(['instant', 'deep', 'hybrid']),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
];
