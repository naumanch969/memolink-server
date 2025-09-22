import { body, param } from 'express-validator';
import { VALIDATION } from '../../shared/constants';

export const createTagValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: VALIDATION.TAG_NAME_MAX_LENGTH })
    .withMessage(`Tag name must be between 1 and ${VALIDATION.TAG_NAME_MAX_LENGTH} characters`),
  
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Color must be a valid hex color (e.g., #FF5733)'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description cannot exceed 200 characters'),
];

export const updateTagValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: VALIDATION.TAG_NAME_MAX_LENGTH })
    .withMessage(`Tag name must be between 1 and ${VALIDATION.TAG_NAME_MAX_LENGTH} characters`),
  
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Color must be a valid hex color (e.g., #FF5733)'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description cannot exceed 200 characters'),
];

export const tagIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid tag ID format'),
];
