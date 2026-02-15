import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { RateLimitMiddleware } from '../../core/middleware/rate-limit.middleware';
import { FileUploadMiddleware } from '../../core/middleware/upload.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { AuthController } from './auth.controller';
import { changePasswordValidation, forgotPasswordValidation, loginValidation, refreshTokenValidation, registerValidation, resendVerificationValidation, resetPasswordValidation, updateProfileValidation, updateSecurityConfigValidation, verifyEmailValidation, verifySecurityAnswerValidation } from './auth.validations';

const router = Router();

// Strict limiter for sensitive auth endpoints
const authLimiter = RateLimitMiddleware.limit({ zone: 'auth', maxRequests: 5, windowMs: 15 * 60 * 1000 });

// Public routes
router.post('/register', authLimiter, registerValidation, ValidationMiddleware.validate, AuthController.register);
router.post('/login', authLimiter, loginValidation, ValidationMiddleware.validate, AuthController.login);
router.post('/google', authLimiter, AuthController.googleLogin);
router.post('/refresh-token', RateLimitMiddleware.limit({ zone: 'refresh', maxRequests: 10, windowMs: 60 * 60 * 1000 }), refreshTokenValidation, ValidationMiddleware.validate, AuthController.refreshToken);
router.post('/forgot-password', authLimiter, forgotPasswordValidation, ValidationMiddleware.validate, AuthController.forgotPassword);
router.post('/reset-password', authLimiter, resetPasswordValidation, ValidationMiddleware.validate, AuthController.resetPassword);
router.post('/verify-email', authLimiter, verifyEmailValidation, ValidationMiddleware.validate, AuthController.verifyEmail);
router.post('/resend-verification', authLimiter, resendVerificationValidation, ValidationMiddleware.validate, AuthController.resendVerification);

// Protected routes
router.use(AuthMiddleware.authenticate); // All routes below require authentication

router.get('/profile', AuthController.getProfile);
router.put('/profile', updateProfileValidation, ValidationMiddleware.validate, AuthController.updateProfile);
router.post('/avatar', FileUploadMiddleware.uploadSingle('avatar'), FileUploadMiddleware.validateFileContent, AuthController.uploadAvatar);
router.delete('/avatar', AuthController.removeAvatar);
router.put('/change-password', changePasswordValidation, ValidationMiddleware.validate, AuthController.changePassword);
router.put('/security-config', updateSecurityConfigValidation, ValidationMiddleware.validate, AuthController.updateSecurityConfig);
router.post('/verify-security', verifySecurityAnswerValidation, ValidationMiddleware.validate, AuthController.verifySecurityAnswer);
router.delete('/account', AuthController.deleteAccount);
router.post('/logout', AuthController.logout);

export default router;
