import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { FileUploadMiddleware } from '../../core/middleware/upload.middleware';
import { AuthController } from './auth.controller';
import { changePasswordValidation, forgotPasswordValidation, loginValidation, refreshTokenValidation, registerValidation, resendVerificationValidation, resetPasswordValidation, updateProfileValidation, updateSecurityConfigValidation, verifyEmailValidation, verifySecurityAnswerValidation } from './auth.validations';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';

const router = Router();

// Public routes
router.post('/register', registerValidation, ValidationMiddleware.validate, AuthController.register);
router.post('/login', loginValidation, ValidationMiddleware.validate, AuthController.login);
router.post('/google', AuthController.googleLogin);
router.post('/refresh-token', refreshTokenValidation, ValidationMiddleware.validate, AuthController.refreshToken);
router.post('/forgot-password', forgotPasswordValidation, ValidationMiddleware.validate, AuthController.forgotPassword);
router.post('/reset-password', resetPasswordValidation, ValidationMiddleware.validate, AuthController.resetPassword);
router.post('/verify-email', verifyEmailValidation, ValidationMiddleware.validate, AuthController.verifyEmail);
router.post('/resend-verification', resendVerificationValidation, ValidationMiddleware.validate, AuthController.resendVerification);

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
