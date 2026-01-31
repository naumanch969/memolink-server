import { OAuth2Client } from 'google-auth-library';
import { emailService } from '../../config/email';
import { config } from '../../config/env';
import { logger } from '../../config/logger';
import { createConflictError, createError, createNotFoundError, createUnauthorizedError } from '../../core/middleware/errorHandler';
import { CryptoHelper } from '../../core/utils/crypto';
import { IUser } from './auth.interfaces';
import { AuthResponse, ChangePasswordRequest, IAuthService, LoginRequest, RegisterRequest, SecurityConfigRequest } from './auth.interfaces';
import { User } from './auth.model';
import { Otp } from './otp.model';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export class AuthService implements IAuthService {
  // Register new user
  async register(userData: RegisterRequest): Promise<{ otp?: any }> {
    try {
      const { email, password, name } = userData;

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        throw createConflictError('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await CryptoHelper.hashPassword(password);

      // Create user
      const user = new User({ email: email.toLowerCase().trim(), password: hashedPassword, name: name.trim(), });

      await user.save();

      logger.info('User registered successfully', { userId: user._id, email: user.email, });

      // Generate OTP for email verification
      const otp = await Otp.generateOtp(email, 'verification');

      // Send verification email
      const emailSent = await emailService.sendVerificationEmail(email, name, otp);
      if (!emailSent) {
        logger.warn('Failed to send verification email', { email });
      }

      const response = { otp: null };

      // Include OTP in response for development environment
      if (config.NODE_ENV === 'development') {
        response.otp = otp;
      }

      return response;
    } catch (error) {
      logger.error('Registration failed:', error);
      throw error;
    }
  }

  // Login user
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const { email, password } = credentials;

      // Find user with password
      const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
      if (!user) {
        throw createUnauthorizedError('Invalid email or password');
      }

      // Check password
      const isPasswordValid = await CryptoHelper.comparePassword(password, user.password);
      if (!isPasswordValid) {
        throw createUnauthorizedError('Invalid email or password');
      }

      // Update last login
      user.lastLoginAt = new Date();
      await user.save();

      logger.info('User logged in successfully', { userId: user._id, email: user.email, });

      // Generate tokens
      const accessToken = CryptoHelper.generateAccessToken({ userId: user._id.toString(), email: user.email, role: user.role, });

      const refreshToken = CryptoHelper.generateRefreshToken({ userId: user._id.toString(), email: user.email, role: user.role, });

      return { user: user.toJSON(), accessToken, refreshToken, };
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  // Google Login
  async googleLogin(idToken: string): Promise<AuthResponse> {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();

      if (!payload) {
        throw createUnauthorizedError('Invalid Google Token');
      }

      const { email, name, sub: googleId, picture } = payload;

      if (!email) {
        throw createUnauthorizedError('Email not found in Google Token');
      }

      let user = await User.findOne({ email: email.toLowerCase().trim() });

      if (user) {
        // Link Google ID if not present
        if (!user.googleId) {
          user.googleId = googleId;
          await user.save();
        }
      } else {
        // Create new user
        user = new User({
          email: email.toLowerCase().trim(),
          name: name || 'User',
          googleId,
          avatar: picture,
          isEmailVerified: true, // Google emails are verified
          // Password is optional now
        });
        await user.save();

        // Send welcome email
        try {
          await emailService.sendWelcomeEmail(user.email, user.name);
        } catch (e) {
          logger.warn('Failed to send welcome email for Google signup', { email });
        }
      }

      // Generate tokens
      const accessToken = CryptoHelper.generateAccessToken({ userId: user._id.toString(), email: user.email, role: user.role, });
      const refreshToken = CryptoHelper.generateRefreshToken({ userId: user._id.toString(), email: user.email, role: user.role, });

      // Update last login
      user.lastLoginAt = new Date();
      await user.save();

      return { user: user.toJSON(), accessToken, refreshToken };
    } catch (error) {
      logger.error('Google login failed:', error);
      throw createUnauthorizedError('Google authentication failed');
    }
  }

  // Refresh access token
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const decoded = CryptoHelper.verifyRefreshToken(refreshToken);

      const user = await User.findById(decoded.userId);
      if (!user) {
        throw createUnauthorizedError('Invalid refresh token');
      }

      const accessToken = CryptoHelper.generateAccessToken({ userId: user._id.toString(), email: user.email, role: user.role, });

      return { accessToken };
    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw createUnauthorizedError('Invalid refresh token');
    }
  }

  // Change password
  async changePassword(userId: string, passwordData: ChangePasswordRequest): Promise<void> {
    try {
      const { currentPassword, newPassword } = passwordData;

      const user = await User.findById(userId).select('+password');
      if (!user) {
        throw createNotFoundError('User');
      }

      // Verify current password
      const isCurrentPasswordValid = await CryptoHelper.comparePassword(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw createUnauthorizedError('Current password is incorrect');
      }

      // Hash new password
      const hashedNewPassword = await CryptoHelper.hashPassword(newPassword);
      user.password = hashedNewPassword;
      await user.save();

      logger.info('Password changed successfully', { userId: user._id, email: user.email, });
    } catch (error) {
      logger.error('Password change failed:', error);
      throw error;
    }
  }

  // Get user profile
  async getProfile(userId: string): Promise<IUser> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw createNotFoundError('User');
      }

      return user;
    } catch (error) {
      logger.error('Get profile failed:', error);
      throw error;
    }
  }

  // Update user profile
  async updateProfile(userId: string, updateData: Partial<IUser>): Promise<IUser> {
    try {
      const user = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true });
      if (!user) {
        throw createNotFoundError('User');
      }

      logger.info('Profile updated successfully', { userId: user._id, email: user.email, });

      return user;
    } catch (error) {
      logger.error('Profile update failed:', error);
      throw error;
    }
  }

  // Delete user account
  async deleteAccount(userId: string): Promise<void> {
    try {
      const user = await User.findByIdAndDelete(userId);
      if (!user) {
        throw createNotFoundError('User');
      }

      logger.info('User account deleted', { userId: user._id, email: user.email, });
    } catch (error) {
      logger.error('Account deletion failed:', error);
      throw error;
    }
  }

  // Verify email with OTP
  async verifyEmail(otp: string): Promise<void> {
    try {
      // Find user by OTP (we need to get the email from the OTP record)
      const otpRecord = await Otp.findOne({
        otp,
        type: 'verification',
        isUsed: false,
        expiresAt: { $gt: new Date() }
      });

      if (!otpRecord) {
        throw createUnauthorizedError('Invalid or expired OTP');
      }

      // Find user by email
      const user = await User.findByEmail(otpRecord.email);
      if (!user) {
        throw createNotFoundError('User not found');
      }

      if (user.isEmailVerified) {
        throw createConflictError('Email is already verified');
      }

      // Verify the OTP
      const isValid = await Otp.verifyOtp(otpRecord.email, otp, 'verification');
      if (!isValid) {
        throw createUnauthorizedError('Invalid OTP');
      }

      // Mark email as verified
      user.isEmailVerified = true;
      // @ts-expect-error User type mismatch
      await user.save();

      // Send welcome email
      const emailSent = await emailService.sendWelcomeEmail(user.email, user.name);
      if (!emailSent) {
        logger.warn('Failed to send welcome email', { email: user.email });
      }

      logger.info('Email verified successfully', { userId: user._id, email: user.email });
    } catch (error) {
      logger.error('Email verification failed:', error);
      throw error;
    }
  }

  // Forgot password
  async forgotPassword(email: string): Promise<void> {
    try {
      // Check if user exists
      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not for security
        logger.info('Password reset requested for non-existent user', { email });
        return;
      }

      // Generate OTP for password reset
      const otp = await Otp.generateOtp(email, 'password_reset');

      // Send password reset email
      const emailSent = await emailService.sendPasswordResetEmail(email, user.name, otp);
      if (!emailSent) {
        logger.warn('Failed to send password reset email', { email });
        throw createError('Failed to send password reset email', 500);
      }

      logger.info('Password reset email sent', { email });
    } catch (error) {
      logger.error('Forgot password failed:', error);
      throw error;
    }
  }

  // Reset password with OTP
  async resetPassword(otp: string, newPassword: string): Promise<void> {
    try {
      // Find OTP record
      const otpRecord = await Otp.findOne({ otp, type: 'password_reset', isUsed: false, expiresAt: { $gt: new Date() } });

      if (!otpRecord) {
        throw createUnauthorizedError('Invalid or expired OTP');
      }

      // Find user by email
      const user = await User.findByEmail(otpRecord.email);
      if (!user) {
        throw createNotFoundError('User not found');
      }

      // Verify the OTP
      const isValid = await Otp.verifyOtp(otpRecord.email, otp, 'password_reset');
      if (!isValid) {
        throw createUnauthorizedError('Invalid OTP');
      }

      // Hash new password
      const hashedPassword = await CryptoHelper.hashPassword(newPassword);

      // Update user password
      user.password = hashedPassword;
      // @ts-expect-error User type mismatch
      await user.save();

      logger.info('Password reset successfully', { userId: user._id, email: user.email });
    } catch (error) {
      logger.error('Password reset failed:', error);
      throw error;
    }
  }

  // Resend verification email
  async resendVerification(email: string): Promise<void> {
    try {
      // Check if user exists
      const user = await User.findByEmail(email);
      if (!user) {
        throw createNotFoundError('User not found');
      }

      if (user.isEmailVerified) {
        throw createConflictError('Email is already verified');
      }

      // Generate new OTP
      const otp = await Otp.generateOtp(email, 'verification');

      // Send verification email
      const emailSent = await emailService.sendVerificationEmail(email, user.name, otp);
      if (!emailSent) {
        logger.warn('Failed to send verification email', { email });
        throw createError('Failed to send verification email', 500);
      }

      logger.info('Verification email resent', { email });
    } catch (error) {
      logger.error('Resend verification failed:', error);
      throw error;
    }
  }
  // Update Security Configuration
  async updateSecurityConfig(userId: string, config: SecurityConfigRequest): Promise<void> {
    try {
      const { question, answer, timeoutMinutes, isEnabled, maskEntries } = config;
      // Select with answerHash to ensure we can retain it if not changing
      const user = await User.findById(userId).select('+securityConfig.answerHash');
      if (!user) {
        throw createNotFoundError('User');
      }

      const securityConfig: any = {
        question,
        timeoutMinutes,
        isEnabled,
        maskEntries
      };

      // Only update hash if a new answer is provided
      if (answer && answer.trim()) {
        securityConfig.answerHash = await CryptoHelper.hashPassword(answer.trim().toLowerCase());
      } else if (user.securityConfig?.answerHash) {
        // Retain existing hash if no new answer provided
        securityConfig.answerHash = user.securityConfig.answerHash;
      }

      user.securityConfig = securityConfig;

      await user.save();
      logger.info('Security config updated', { userId });
    } catch (error) {
      logger.error('Update security config failed', error);
      throw error;
    }
  }

  // Verify Security Answer
  async verifySecurityAnswer(userId: string, answer: string): Promise<{ valid: boolean }> {
    try {
      // Find user and explicitly select securityConfig including answerHash
      const user = await User.findById(userId).select('+securityConfig.answerHash');
      if (!user) {
        throw createNotFoundError('User');
      }

      if (!user.securityConfig || !user.securityConfig.answerHash || !user.securityConfig.isEnabled) {
        // If not configured but requested, handle gracefully or deny
        return { valid: false };
      }

      const isValid = await CryptoHelper.comparePassword(answer.trim().toLowerCase(), user.securityConfig.answerHash);

      if (!isValid) {
        // TRAP: Send email alert about failed attempt
        // We do this asynchronously so we don't block the response
        try {
          // Send specific email method for security alert
          await emailService.sendSecurityAlert(user.email, user.name, answer);
          logger.warn(`Security Trap Triggered! User: ${user.email}, Wrong Answer: ${answer}`);
        } catch (e) {
          logger.error('Failed to send security alert', e);
        }
      }

      return { valid: isValid };
    } catch (error) {
      logger.error('Verify security answer failed', error);
      throw error;
    }
  }
}

export const authService = new AuthService();

export default AuthService;
