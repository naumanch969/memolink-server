import { Request, Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.utils';
import { AuthenticatedRequest, ForgotPasswordRequest, GoogleLoginRequest, LoginRequest, RefreshTokenRequest, RegisterRequest, ResendVerificationRequest, ResetPasswordRequest, SecurityConfigRequest, VerifyEmailRequest } from './auth.interfaces';
import { authService } from './auth.service';

export class AuthController {
  // Register new user
  static async register(req: Request, res: Response) {
    try {
      const userData: RegisterRequest = req.body;
      const result = await authService.register(userData);

      ResponseHelper.created(res, result, 'User registered successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to register user', 500, error);
    }
  }

  // Login user
  static async login(req: Request, res: Response) {
    try {
      const loginData: LoginRequest = req.body;
      const result = await authService.login(loginData);

      ResponseHelper.success(res, result, 'Login successful');
    } catch (error) {
      ResponseHelper.error(res, 'Login failed', 401, error);
    }
  }

  // Google Login
  static async googleLogin(req: Request, res: Response) {
    try {
      const { idToken }: GoogleLoginRequest = req.body;
      const result = await authService.googleLogin(idToken);

      ResponseHelper.success(res, result, 'Google login successful');
    } catch (error) {
      ResponseHelper.error(res, 'Google login failed', 401, error);
    }
  }

  // Refresh Token
  static async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken }: RefreshTokenRequest = req.body;
      const result = await authService.refreshToken(refreshToken);

      ResponseHelper.success(res, result, 'Token refreshed successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Token refresh failed', 401, error);
    }
  }

  // Logout
  static async logout(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      await authService.logout(userId);

      ResponseHelper.success(res, null, 'Logout successful');
    } catch (error) {
      ResponseHelper.error(res, 'Logout failed', 500, error);
    }
  }

  // Get current user profile
  static async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const user = await authService.getProfile(userId);

      ResponseHelper.success(res, user, 'User profile retrieved');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve user profile', 500, error);
    }
  }

  // Update profile
  static async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const updateData = req.body;
      const user = await authService.updateProfile(userId, updateData);

      ResponseHelper.success(res, user, 'Profile updated successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to update user profile', 500, error);
    }
  }

  // Upload Avatar
  static async uploadAvatar(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      if (!req.file) {
        return ResponseHelper.badRequest(res, 'No file uploaded');
      }
      const user = await authService.uploadAvatar(userId, req.file);
      ResponseHelper.success(res, user, 'Avatar uploaded successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to upload avatar', 500, error);
    }
  }

  // Remove Avatar
  static async removeAvatar(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const user = await authService.removeAvatar(userId);
      ResponseHelper.success(res, user, 'Avatar removed successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to remove avatar', 500, error);
    }
  }

  // Request Email Verification (Alias for resendVerification in routes)
  static async resendVerification(req: Request, res: Response) {
    try {
      const { email }: ResendVerificationRequest = req.body;
      await authService.resendVerification(email);
      ResponseHelper.success(res, null, 'Verification email sent');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to send verification email', 500, error);
    }
  }

  // Verify Email
  static async verifyEmail(req: Request, res: Response) {
    try {
      const { otp }: VerifyEmailRequest = req.body;
      await authService.verifyEmail(otp);
      ResponseHelper.success(res, null, 'Email verified successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Email verification failed', 400, error);
    }
  }

  // Forgot Password
  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email }: ForgotPasswordRequest = req.body;
      await authService.forgotPassword(email);
      ResponseHelper.success(res, null, 'Password reset email sent');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to process forgot password request', 500, error);
    }
  }

  // Reset Password
  static async resetPassword(req: Request, res: Response) {
    try {
      const { otp, newPassword }: ResetPasswordRequest = req.body;
      await authService.resetPassword(otp, newPassword);
      ResponseHelper.success(res, null, 'Password reset successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Password reset failed', 400, error);
    }
  }

  // Change Password
  static async changePassword(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      await authService.changePassword(userId, req.body);
      ResponseHelper.success(res, null, 'Password changed successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to change password', 400, error);
    }
  }

  // Update Security Config (2FA)
  static async updateSecurityConfig(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const config: SecurityConfigRequest = req.body;
      await authService.updateSecurityConfig(userId, config);
      ResponseHelper.success(res, null, 'Security settings updated');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to update security settings', 500, error);
    }
  }

  // Verify Security Answer
  static async verifySecurityAnswer(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { answer } = req.body;
      const result = await authService.verifySecurityAnswer(userId, answer);
      if (result.valid) {
        ResponseHelper.success(res, result, 'Answer verified');
      } else {
        ResponseHelper.error(res, 'Incorrect answer', 401);
      }
    } catch (error) {
      ResponseHelper.error(res, 'Failed to verify answer', 500, error);
    }
  }

  // Delete Account
  static async deleteAccount(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      await authService.deleteAccount(userId);
      ResponseHelper.success(res, null, 'Account deleted successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to delete account', 500, error);
    }
  }
}
