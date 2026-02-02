import { body, param } from 'express-validator';
import { VALIDATION } from '../../shared/constants';

export const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .isLength({ max: VALIDATION.EMAIL_MAX_LENGTH })
    .withMessage(`Email cannot exceed ${VALIDATION.EMAIL_MAX_LENGTH} characters`),

  body('password')
    .isLength({ min: VALIDATION.PASSWORD_MIN_LENGTH, max: VALIDATION.PASSWORD_MAX_LENGTH })
    .withMessage(`Password must be between ${VALIDATION.PASSWORD_MIN_LENGTH} and ${VALIDATION.PASSWORD_MAX_LENGTH} characters`)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),

  body('name')
    .trim()
    .isLength({ min: 1, max: VALIDATION.NAME_MAX_LENGTH })
    .withMessage(`Name must be between 1 and ${VALIDATION.NAME_MAX_LENGTH} characters`)
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
];

export const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

export const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .isLength({ min: VALIDATION.PASSWORD_MIN_LENGTH, max: VALIDATION.PASSWORD_MAX_LENGTH })
    .withMessage(`Password must be between ${VALIDATION.PASSWORD_MIN_LENGTH} and ${VALIDATION.PASSWORD_MAX_LENGTH} characters`)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
];

export const refreshTokenValidation = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
    .isJWT()
    .withMessage('Invalid refresh token format'),
];

export const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
];

export const resetPasswordValidation = [
  body('otp')
    .notEmpty()
    .withMessage('OTP is required'),

  body('newPassword')
    .isLength({ min: VALIDATION.PASSWORD_MIN_LENGTH, max: VALIDATION.PASSWORD_MAX_LENGTH })
    .withMessage(`Password must be between ${VALIDATION.PASSWORD_MIN_LENGTH} and ${VALIDATION.PASSWORD_MAX_LENGTH} characters`)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
];

export const verifyEmailValidation = [
  body('otp')
    .notEmpty()
    .withMessage('OTP is required'),
];

export const resendVerificationValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
];

export const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: VALIDATION.NAME_MAX_LENGTH })
    .withMessage(`Name must be between 1 and ${VALIDATION.NAME_MAX_LENGTH} characters`)
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),

  body('avatar')
    .optional()
    .custom((value) => {
      // Allow empty string for avatar removal
      if (value === '' || value === null) return true;
      // Validate URL if a value is provided
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error('Avatar must be a valid URL');
      }
    }),

  body('preferences.theme')
    .optional()
    .isIn(['light', 'dark', 'auto', 'system'])
    .withMessage('Theme must be light, dark, auto, or system'),

  body('preferences.notifications')
    .optional()
    .isBoolean()
    .withMessage('Notifications preference must be a boolean'),

  body('preferences.privacy')
    .optional()
    .isIn(['public', 'private'])
    .withMessage('Privacy preference must be public or private'),
];

export const userIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid user ID format'),
];

export const updateSecurityConfigValidation = [
  body('question').trim().notEmpty().withMessage('Question is required'),
  body('answer').trim().notEmpty().withMessage('Answer is required'),
  body('timeoutMinutes').isInt({ min: 1 }).withMessage('Timeout must be at least 1 minute'),
  body('isEnabled').isBoolean().withMessage('Enabled status is required'),
  body('maskEntries').optional().isBoolean().withMessage('Mask entries preference must be a boolean'),
];

export const verifySecurityAnswerValidation = [
  body('answer').trim().notEmpty().withMessage('Answer is required'),
];
