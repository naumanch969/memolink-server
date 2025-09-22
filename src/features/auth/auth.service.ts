import { User } from './auth.model';
import { CryptoHelper } from '../../core/utils/crypto';
import { logger } from '../../config/logger';
import { createError, createNotFoundError, createConflictError, createUnauthorizedError } from '../../core/middleware/errorHandler';
import { AuthResponse, LoginRequest, RegisterRequest, ChangePasswordRequest, IAuthService } from './auth.interfaces';
import { IUser } from '../../shared/types';
import { Helpers } from '../../shared/helpers';

export class AuthService implements IAuthService {
  // Register new user
  async register(userData: RegisterRequest): Promise<AuthResponse> {
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
      const user = new User({
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name.trim(),
      });

      await user.save();

      logger.info('User registered successfully', {
        userId: user._id,
        email: user.email,
      });

      // Generate tokens
      const accessToken = CryptoHelper.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      const refreshToken = CryptoHelper.generateRefreshToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      return {
        user: user.toJSON(),
        accessToken,
        refreshToken,
      };
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

      logger.info('User logged in successfully', {
        userId: user._id,
        email: user.email,
      });

      // Generate tokens
      const accessToken = CryptoHelper.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      const refreshToken = CryptoHelper.generateRefreshToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      return {
        user: user.toJSON(),
        accessToken,
        refreshToken,
      };
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
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

      const accessToken = CryptoHelper.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

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

      logger.info('Password changed successfully', {
        userId: user._id,
        email: user.email,
      });
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
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!user) {
        throw createNotFoundError('User');
      }

      logger.info('Profile updated successfully', {
        userId: user._id,
        email: user.email,
      });

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

      logger.info('User account deleted', {
        userId: user._id,
        email: user.email,
      });
    } catch (error) {
      logger.error('Account deletion failed:', error);
      throw error;
    }
  }

  // Verify email (placeholder for future implementation)
  async verifyEmail(token: string): Promise<void> {
    // TODO: Implement email verification logic
    logger.info('Email verification requested', { token });
    throw createError('Email verification not implemented yet', 501);
  }

  // Forgot password (placeholder for future implementation)
  async forgotPassword(email: string): Promise<void> {
    // TODO: Implement forgot password logic
    logger.info('Password reset requested', { email });
    throw createError('Password reset not implemented yet', 501);
  }

  // Reset password (placeholder for future implementation)
  async resetPassword(token: string, newPassword: string): Promise<void> {
    // TODO: Implement password reset logic
    logger.info('Password reset attempted', { token });
    throw createError('Password reset not implemented yet', 501);
  }
}

export const authService = new AuthService();

export default AuthService;
