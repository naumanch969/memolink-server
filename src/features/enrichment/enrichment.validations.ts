import { body } from 'express-validator';

export const cleanTextValidation = [
    body('text').notEmpty().withMessage('Text is required').isString().trim(),
];
