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
    .trim(),
  // .isMobilePhone('any') // Strict validation removed to allow various formats

  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL'),

  body('jobTitle')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Job title cannot exceed 100 characters'),

  body('company')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Company cannot exceed 100 characters'),

  body('birthday')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Birthday must be a valid date'),

  body('address.street').optional().trim(),
  body('address.city').optional().trim(),
  body('address.state').optional().trim(),
  body('address.country').optional().trim(),
  body('address.zipCode').optional().trim(),

  body('socialLinks.linkedin').optional().trim().isURL().withMessage('Invalid LinkedIn URL'),
  body('socialLinks.twitter').optional().trim().isURL().withMessage('Invalid Twitter URL'),
  body('socialLinks.website').optional().trim().isURL().withMessage('Invalid Website URL'),
  body('socialLinks.facebook').optional().trim().isURL().withMessage('Invalid Facebook URL'),
  body('socialLinks.instagram').optional().trim().isURL().withMessage('Invalid Instagram URL'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array of strings'),
  body('tags.*')
    .optional()
    .trim(),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Notes cannot exceed 5000 characters'),
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
    .trim(),

  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL'),

  body('jobTitle').optional().trim().isLength({ max: 100 }),
  body('company').optional().trim().isLength({ max: 100 }),
  body('birthday').optional().isISO8601().toDate(),

  body('address.street').optional().trim(),
  body('address.city').optional().trim(),
  body('address.state').optional().trim(),
  body('address.country').optional().trim(),
  body('address.zipCode').optional().trim(),

  body('socialLinks.linkedin').optional().trim().isURL(),
  body('socialLinks.twitter').optional().trim().isURL(),
  body('socialLinks.website').optional().trim().isURL(),
  body('socialLinks.facebook').optional().trim().isURL(),
  body('socialLinks.instagram').optional().trim().isURL(),

  body('tags').optional().isArray(),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Notes cannot exceed 5000 characters'),
];

export const personIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid person ID format'),
];
