import { param } from 'express-validator';

export const mediaIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid media ID format'),
];
