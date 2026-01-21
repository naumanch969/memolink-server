import { body, param, query } from 'express-validator';
import { VALIDATION } from '../../shared/constants';

export const createEntryValidation = [
  body('content')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 0, max: VALIDATION.ENTRY_CONTENT_MAX_LENGTH })
    .withMessage(`Content must not exceed ${VALIDATION.ENTRY_CONTENT_MAX_LENGTH} characters`),

  body('type')
    .optional()
    .isIn(['text', 'media', 'mixed'])
    .withMessage('Type must be text, media, or mixed'),

  body('mentions')
    .optional()
    .isArray()
    .withMessage('Mentions must be an array'),

  body('mentions.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid mention ID format'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),

  body('tags.*')
    .optional()
    .custom((value) => {
      // Allow MongoDB ObjectId or a non-empty string for new tags
      return /^[0-9a-fA-F]{24}$/.test(value) || (typeof value === 'string' && value.trim().length > 0);
    })
    .withMessage('Tags must be a valid ID or a non-empty string'),

  body('media')
    .optional()
    .isArray()
    .withMessage('Media must be an array'),

  body('media.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid media ID format'),

  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean'),

  body('mood')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Mood cannot exceed 50 characters'),

  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location cannot exceed 200 characters'),
];

export const updateEntryValidation = [
  body('content')
    .optional()
    .trim()
    .isLength({ min: 1, max: VALIDATION.ENTRY_CONTENT_MAX_LENGTH })
    .withMessage(`Content must be between 1 and ${VALIDATION.ENTRY_CONTENT_MAX_LENGTH} characters`),

  body('type')
    .optional()
    .isIn(['text', 'media', 'mixed'])
    .withMessage('Type must be text, media, or mixed'),

  body('mentions')
    .optional()
    .isArray()
    .withMessage('Mentions must be an array'),

  body('mentions.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid mention ID format'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),

  body('tags.*')
    .optional()
    .custom((value) => {
      // Allow MongoDB ObjectId or a non-empty string for new tags
      return /^[0-9a-fA-F]{24}$/.test(value) || (typeof value === 'string' && value.trim().length > 0);
    })
    .withMessage('Tags must be a valid ID or a non-empty string'),

  body('media')
    .optional()
    .isArray()
    .withMessage('Media must be an array'),

  body('media.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid media ID format'),

  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean'),

  body('mood')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Mood cannot exceed 50 characters'),

  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location cannot exceed 200 characters'),
];

export const entryIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid entry ID format'),
];

export const searchEntriesValidation = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters'),

  query('type')
    .optional()
    .isIn(['text', 'media', 'mixed'])
    .withMessage('Type must be text, media, or mixed'),

  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid ISO 8601 date'),

  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid ISO 8601 date'),

  query('tags')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        const tags = value.split(',');
        return tags.every(tag => /^[0-9a-fA-F]{24}$/.test(tag.trim()));
      }
      return true;
    })
    .withMessage('Tags must be comma-separated valid MongoDB ObjectIds'),

  query('people')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        const people = value.split(',');
        return people.every(person => /^[0-9a-fA-F]{24}$/.test(person.trim()));
      }
      return true;
    })
    .withMessage('People must be comma-separated valid MongoDB ObjectIds'),

  query('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 1000'),

  query('sort')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'content'])
    .withMessage('Sort must be createdAt, updatedAt, or content'),

  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be asc or desc'),
];
