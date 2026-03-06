import { body, param, query } from 'express-validator';
import { VALIDATION } from '../../shared/constants';

export const createEntryValidation = [
    body('content')
        .notEmpty().withMessage('Content is required')
        .isString().withMessage('Content must be a string')
        .isLength({ max: VALIDATION.ENTRY_CONTENT_MAX_LENGTH }).withMessage(`Content exceeds ${VALIDATION.ENTRY_CONTENT_MAX_LENGTH} characters`),
    body('type').optional().isIn(['text', 'media', 'mixed']).withMessage('Invalid entry type'),
    body('title').optional().isString().isLength({ max: 200 }),
    body('isPrivate').optional().isBoolean().toBoolean(),
    body('isPinned').optional().isBoolean().toBoolean(),
    body('isImportant').optional().isBoolean().toBoolean(),
    body('isFavorite').optional().isBoolean().toBoolean(),
    body('location').optional().isString().isLength({ max: 200 }),
    body('tags').optional().isArray(),
    body('tags.*').isString().notEmpty(),
    body('media').optional().isArray(),
    body('media.*').isMongoId().withMessage('Invalid media ID format'),
    body('collectionId').optional().isMongoId().withMessage('Invalid collection ID format'),
];

export const updateEntryValidation = [
    param('id').isMongoId().withMessage('Invalid entry ID format'),
    body('content').optional().isString().isLength({ max: VALIDATION.ENTRY_CONTENT_MAX_LENGTH }),
    body('type').optional().isIn(['text', 'media', 'mixed']),
    body('title').optional().isString().isLength({ max: 200 }),
    body('isPrivate').optional().isBoolean().toBoolean(),
    body('isPinned').optional().isBoolean().toBoolean(),
    body('isImportant').optional().isBoolean().toBoolean(),
    body('isFavorite').optional().isBoolean().toBoolean(),
    body('location').optional().isString().isLength({ max: 200 }),
    body('tags').optional().isArray(),
    body('media').optional().isArray(),
    body('collectionId').optional().isMongoId(),
];

export const entryIdValidation = [
    param('id').isMongoId().withMessage('Invalid entry ID format'),
];

export const searchEntriesValidation = [
    query('q').optional().isString().isLength({ min: 2, max: 100 }),
    query('type').optional().isIn(['text', 'media', 'mixed']),
    query('mode').optional().isIn(['instant', 'deep', 'hybrid']),
    query('dateFrom').optional().isISO8601().toDate(),
    query('dateTo').optional().isISO8601().toDate(),
    query('isFavorite').optional().isBoolean().toBoolean(),
    query('isImportant').optional().isBoolean().toBoolean(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('tags').optional().customSanitizer(v => v ? (typeof v === 'string' ? v.split(',') : v) : undefined),
    query('collectionId').optional().isMongoId(),
];
