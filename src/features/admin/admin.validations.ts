import { body, param } from 'express-validator';

export const updateConfigValidation = [
    param('key').notEmpty().withMessage('Config key is required').isString().trim(),
    body('value').notEmpty().withMessage('Value is required'),
];
