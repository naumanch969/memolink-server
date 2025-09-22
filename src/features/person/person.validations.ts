import { body, param } from 'express-validator';
import { VALIDATION } from '../../shared/constants';

export const createPersonValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: VALIDATION.PERSON_NAME_MAX_LENGTH })
    .withMessage(`Name must be between 1 and ${VALIDATION.PERSON_NAME_MAX_LENGTH} characters`),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .trim()
    .isMobilePhone('en-PK')
    .withMessage('Please provide a valid phone number'),
  
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
];

export const updatePersonValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: VALIDATION.PERSON_NAME_MAX_LENGTH })
    .withMessage(`Name must be between 1 and ${VALIDATION.PERSON_NAME_MAX_LENGTH} characters`),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .trim()
    .isMobilePhone('en-PK')
    .withMessage('Please provide a valid phone number'),
  
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
];

export const personIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid person ID format'),
];
