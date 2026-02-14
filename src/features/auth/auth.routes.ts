import { Router } from 'express';
import { uploadSingle, validateFileContent } from '../../core/middleware/upload.middleware';
import { validationMiddleware } from '../../core/middleware/validation.middleware';
import { AuthController } from './auth.controller';
import { changePasswordValidation, forgotPasswordValidation, loginValidation, refreshTokenValidation, registerValidation, resendVerificationValidation, resetPasswordValidation, updateProfileValidation, updateSecurityConfigValidation, verifyEmailValidation, verifySecurityAnswerValidation } from './auth.validations';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/register', registerValidation, validationMiddleware, AuthController.register);
router.post('/login', loginValidation, validationMiddleware, AuthController.login);
router.post('/google', AuthController.googleLogin);
router.post('/refresh-token', refreshTokenValidation, validationMiddleware, AuthController.refreshToken);
router.post('/forgot-password', forgotPasswordValidation, validationMiddleware, AuthController.forgotPassword);
router.post('/reset-password', resetPasswordValidation, validationMiddleware, AuthController.resetPassword);
router.post('/verify-email', verifyEmailValidation, validationMiddleware, AuthController.verifyEmail);
router.post('/resend-verification', resendVerificationValidation, validationMiddleware, AuthController.resendVerification);

// Protected routes
router.use(AuthMiddleware.authenticate); // All routes below require authentication

router.get('/profile', AuthController.getProfile);
router.put('/profile', updateProfileValidation, validationMiddleware, AuthController.updateProfile);
router.post('/avatar', uploadSingle('avatar'), validateFileContent, AuthController.uploadAvatar);
router.delete('/avatar', AuthController.removeAvatar);
router.put('/change-password', changePasswordValidation, validationMiddleware, AuthController.changePassword);
router.put('/security-config', updateSecurityConfigValidation, validationMiddleware, AuthController.updateSecurityConfig);
router.post('/verify-security', verifySecurityAnswerValidation, validationMiddleware, AuthController.verifySecurityAnswer);
router.delete('/account', AuthController.deleteAccount);
router.post('/logout', AuthController.logout);

export default router;
