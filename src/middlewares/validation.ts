import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
    return;
  }
  next();
};

// Entry validation rules
export const validateEntry = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Content must be between 1 and 10000 characters'),
  body('timestamp')
    .optional()
    .isISO8601()
    .withMessage('Timestamp must be a valid ISO date'),
  body('mood')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Mood must be less than 50 characters'),
  body('people')
    .optional()
    .isArray()
    .withMessage('People must be an array'),
  body('people.*.name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Person name must be between 1 and 100 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Tag must be between 1 and 50 characters'),
  body('images')
    .optional()
    .isArray()
    .withMessage('Images must be an array'),
  body('images.*')
    .optional()
    .isURL()
    .withMessage('Image must be a valid URL'),
];

// Person validation rules
export const validatePerson = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL'),
];

// Category validation rules
export const validateCategory = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('displayName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Display name must be between 1 and 100 characters'),
];

// User validation rules
export const validateUser = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
];

// Search validation rules
export const validateSearch = [
  body('query')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Search query must be between 1 and 500 characters'),
  body('filters.mood')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Mood filter must be less than 50 characters'),
  body('filters.dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid ISO date'),
  body('filters.dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid ISO date'),
];
