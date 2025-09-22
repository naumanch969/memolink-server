import { body, param } from 'express-validator';
import { VALIDATION } from '../../shared/constants';

export const createHabitValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: VALIDATION.HABIT_NAME_MAX_LENGTH })
    .withMessage(`Habit name must be between 1 and ${VALIDATION.HABIT_NAME_MAX_LENGTH} characters`),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: VALIDATION.HABIT_DESCRIPTION_MAX_LENGTH })
    .withMessage(`Description cannot exceed ${VALIDATION.HABIT_DESCRIPTION_MAX_LENGTH} characters`),
  
  body('frequency')
    .isIn(['daily', 'weekly', 'monthly', 'custom'])
    .withMessage('Frequency must be daily, weekly, monthly, or custom'),
  
  body('customDays')
    .optional()
    .isArray()
    .withMessage('Custom days must be an array'),
  
  body('customDays.*')
    .optional()
    .isInt({ min: 0, max: 6 })
    .withMessage('Custom days must be integers between 0 and 6'),
  
  body('targetCount')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Target count must be a positive integer'),
  
  body('unit')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Unit cannot exceed 20 characters'),
  
  body('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Color must be a valid hex color'),
  
  body('icon')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Icon cannot exceed 50 characters'),
];

export const updateHabitValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: VALIDATION.HABIT_NAME_MAX_LENGTH })
    .withMessage(`Habit name must be between 1 and ${VALIDATION.HABIT_NAME_MAX_LENGTH} characters`),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: VALIDATION.HABIT_DESCRIPTION_MAX_LENGTH })
    .withMessage(`Description cannot exceed ${VALIDATION.HABIT_DESCRIPTION_MAX_LENGTH} characters`),
  
  body('frequency')
    .optional()
    .isIn(['daily', 'weekly', 'monthly', 'custom'])
    .withMessage('Frequency must be daily, weekly, monthly, or custom'),
  
  body('customDays')
    .optional()
    .isArray()
    .withMessage('Custom days must be an array'),
  
  body('customDays.*')
    .optional()
    .isInt({ min: 0, max: 6 })
    .withMessage('Custom days must be integers between 0 and 6'),
  
  body('targetCount')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Target count must be a positive integer'),
  
  body('unit')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Unit cannot exceed 20 characters'),
  
  body('status')
    .optional()
    .isIn(['active', 'paused', 'completed', 'archived'])
    .withMessage('Status must be active, paused, completed, or archived'),
  
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Color must be a valid hex color'),
  
  body('icon')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Icon cannot exceed 50 characters'),
];

export const habitIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid habit ID format'),
];

export const createHabitLogValidation = [
  body('habitId')
    .isMongoId()
    .withMessage('Invalid habit ID format'),
  
  body('date')
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date'),
  
  body('completed')
    .isBoolean()
    .withMessage('Completed must be a boolean'),
  
  body('count')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Count must be a non-negative integer'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  
  body('mood')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Mood cannot exceed 50 characters'),
];

export const updateHabitLogValidation = [
  body('completed')
    .optional()
    .isBoolean()
    .withMessage('Completed must be a boolean'),
  
  body('count')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Count must be a non-negative integer'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  
  body('mood')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Mood cannot exceed 50 characters'),
];
