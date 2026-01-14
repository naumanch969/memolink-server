import { body } from 'express-validator';

export const exportValidation = [
  body('format')
    .isIn(['json', 'csv', 'pdf', 'markdown'])
    .withMessage('Format must be json, csv, pdf, or markdown'),

  body('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid ISO 8601 date'),

  body('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid ISO 8601 date'),

  body('includeMedia')
    .optional()
    .isBoolean()
    .withMessage('Include media must be a boolean'),

  body('includePrivate')
    .optional()
    .isBoolean()
    .withMessage('Include private must be a boolean'),
];
