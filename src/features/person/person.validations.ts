import { body, query } from 'express-validator';

// Create person validation rules
export const validateCreatePerson = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters')
    .trim(),
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL')
    .trim(),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail()
    .trim(),
  body('phone')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Phone must be less than 20 characters')
    .trim(),
  body('relationship')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Relationship must be less than 100 characters')
    .trim(),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Each tag must be less than 50 characters')
    .trim(),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters')
    .trim(),
  body('birthday')
    .optional()
    .isISO8601()
    .withMessage('Birthday must be a valid ISO date'),
  body('lastContact')
    .optional()
    .isISO8601()
    .withMessage('Last contact must be a valid ISO date'),
  body('contactFrequency')
    .optional()
    .isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'rarely'])
    .withMessage('Contact frequency must be one of: daily, weekly, monthly, quarterly, yearly, rarely'),
];

// Update person validation rules
export const validateUpdatePerson = [
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters')
    .trim(),
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL')
    .trim(),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail()
    .trim(),
  body('phone')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Phone must be less than 20 characters')
    .trim(),
  body('relationship')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Relationship must be less than 100 characters')
    .trim(),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Each tag must be less than 50 characters')
    .trim(),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters')
    .trim(),
  body('birthday')
    .optional()
    .isISO8601()
    .withMessage('Birthday must be a valid ISO date'),
  body('lastContact')
    .optional()
    .isISO8601()
    .withMessage('Last contact must be a valid ISO date'),
  body('contactFrequency')
    .optional()
    .isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'rarely'])
    .withMessage('Contact frequency must be one of: daily, weekly, monthly, quarterly, yearly, rarely'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Is active must be a boolean'),
];

// Search people validation rules
export const validateSearchPeople = [
  query('query')
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters')
    .trim(),
  query('relationship')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Relationship filter must be less than 100 characters')
    .trim(),
  query('tags')
    .optional()
    .isArray()
    .withMessage('Tags filter must be an array'),
  query('tags.*')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Each tag filter must be less than 50 characters')
    .trim(),
];
