import { body } from 'express-validator';

// Register validation rules
export const validateRegister = [
  body('email')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail()
    .trim(),
  body('password')
    .isLength({ min: 6, max: 100 })
    .withMessage('Password must be between 6 and 100 characters')
    .trim(),
  body('name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Name must be less than 100 characters')
    .trim(),
];

// Login validation rules
export const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail()
    .trim(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .trim(),
];

// Profile update validation rules
export const validateProfileUpdate = [
  body('name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Name must be less than 100 characters')
    .trim(),
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL')
    .trim(),
  body('preferences.theme')
    .optional()
    .isIn(['light', 'dark', 'auto'])
    .withMessage('Theme must be light, dark, or auto'),
  body('preferences.language')
    .optional()
    .isLength({ max: 10 })
    .withMessage('Language must be less than 10 characters')
    .trim(),
  body('preferences.timezone')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Timezone must be less than 50 characters')
    .trim(),
  body('preferences.notifications')
    .optional()
    .isBoolean()
    .withMessage('Notifications must be a boolean'),
  body('preferences.emailNotifications')
    .optional()
    .isBoolean()
    .withMessage('Email notifications must be a boolean'),
  body('preferences.pushNotifications')
    .optional()
    .isBoolean()
    .withMessage('Push notifications must be a boolean'),
  body('preferences.privacyLevel')
    .optional()
    .isIn(['public', 'friends', 'private'])
    .withMessage('Privacy level must be public, friends, or private'),
];
