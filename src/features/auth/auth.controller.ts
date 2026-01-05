import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { ResponseHelper } from '../../core/utils/response';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { AuthenticatedRequest } from '../../shared/types';
import { LoginRequest, RegisterRequest, ChangePasswordRequest, RefreshTokenRequest, ForgotPasswordRequest, ResetPasswordRequest, VerifyEmailRequest, ResendVerificationRequest, SecurityConfigRequest } from './auth.interfaces';

export class AuthController {
  // Register new user
  static register = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userData: RegisterRequest = req.body;
    const result = await authService.register(userData);

    ResponseHelper.created(res, result, 'User registered successfully');
  });

  // Login user
  static login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const credentials: LoginRequest = req.body;
    const result = await authService.login(credentials);

    ResponseHelper.success(res, result, 'Login successful');
  });

  // Refresh access token
  static refreshToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { refreshToken }: RefreshTokenRequest = req.body;
    const result = await authService.refreshToken(refreshToken);

    ResponseHelper.success(res, result, 'Token refreshed successfully');
  });

  // Get current user profile
  static getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const user = await authService.getProfile(userId);

    ResponseHelper.success(res, user, 'Profile retrieved successfully');
  });

  // Update user profile
  static updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const updateData = req.body;
    const user = await authService.updateProfile(userId, updateData);

    ResponseHelper.success(res, user, 'Profile updated successfully');
  });

  // Change password
  static changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const passwordData: ChangePasswordRequest = req.body;
    await authService.changePassword(userId, passwordData);

    ResponseHelper.success(res, null, 'Password changed successfully');
  });

  // Delete user account
  static deleteAccount = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    await authService.deleteAccount(userId);

    ResponseHelper.success(res, null, 'Account deleted successfully');
  });

  // Verify email
  static verifyEmail = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { otp }: VerifyEmailRequest = req.body;
    await authService.verifyEmail(otp);

    ResponseHelper.success(res, null, 'Email verified successfully');
  });

  // Forgot password
  static forgotPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { email }: ForgotPasswordRequest = req.body;
    await authService.forgotPassword(email);

    ResponseHelper.success(res, null, 'Password reset email sent');
  });

  // Reset password
  static resetPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { otp, newPassword }: ResetPasswordRequest = req.body;
    await authService.resetPassword(otp, newPassword);

    ResponseHelper.success(res, null, 'Password reset successfully');
  });

  // Resend verification email
  static resendVerification = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { email }: ResendVerificationRequest = req.body;
    // TODO: Implement resend verification logic
    ResponseHelper.success(res, null, 'Verification email sent');
  });

  // Logout (client-side token removal)
  static logout = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Since we're using stateless JWT, logout is handled client-side
    // In a more advanced implementation, you might maintain a token blacklist
    ResponseHelper.success(res, null, 'Logged out successfully');
  });
  // Update Security Config
  static updateSecurityConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const config: SecurityConfigRequest = req.body;
    await authService.updateSecurityConfig(userId, config);

    ResponseHelper.success(res, null, 'Security settings updated successfully');
  });

  // Verify Security Answer
  static verifySecurityAnswer = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { answer } = req.body;
    const result = await authService.verifySecurityAnswer(userId, answer);

    if (result.valid) {
      ResponseHelper.success(res, { success: true }, 'Security answer verified');
    } else {
      // 403 Forbidden is appropriate for security failures
      ResponseHelper.error(res, 'Invalid Security Answer', 403);
    }
  });
}

export default AuthController;
