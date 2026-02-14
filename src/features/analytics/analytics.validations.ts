import { query } from 'express-validator';

export const getAnalyticsValidation = [
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
    query('groupBy').optional().isIn(['day', 'week', 'month']),
];
