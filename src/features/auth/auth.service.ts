import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { cloudinaryService } from '../../config/cloudinary.service';
import { emailService } from '../../config/email.service';
import { config } from '../../config/env';
import { logger } from '../../config/logger';
import { CacheKeys } from '../../core/cache/cache.keys';
import { cacheService } from '../../core/cache/cache.service';
import { cryptoService } from '../../core/crypto/crypto.service';
import { encryptionSessionService } from '../../core/encryption/encryption-session.service';
import { encryptionService } from '../../core/encryption/encryption.service';
import { ApiError } from '../../core/errors/api.error';
import { IAuthService } from "./auth.interfaces";
import { User } from './auth.model';
import { AuthResponse, ChangePasswordRequest, IUser, LoginRequest, RegisterRequest, RegisterResponse, SecurityConfigRequest, VaultRecoveryRequest, VaultStatus } from './auth.types';
import { Otp } from './otp.model';
import { vaultService } from './vault.service';

const googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID);

export class AuthService implements IAuthService {

  async register(userData: RegisterRequest): Promise<RegisterResponse> {
    try {
      const { email, password, name, securityQuestion, securityAnswer } = userData;

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        throw ApiError.conflict('User with this email already exists');
      }

      // Hash password (for auth)
      const hashedPassword = await cryptoService.hashPassword(password);

      // Create user instance
      const user = new User({
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name.trim(),
      });

      // --- Vault Generation ---
      const { recoveryPhrase } = await vaultService.initializeVault(user as any, {
        password,
        securityQuestion,
        securityAnswer
      });

      // Generate OTP for email verification
      const otp = await Otp.generateOtp(email, 'verification');

      // Send verification email
      const emailSent = await emailService.sendVerificationEmail(email, name, otp);
      if (!emailSent) {
        logger.warn('Failed to send verification email', { email });
      }

      const result: RegisterResponse = { otp: undefined, recoveryPhrase };
      if (config.NODE_ENV === 'development') {
        result.otp = otp;
      }

      return result;
    } catch (error) {
      logger.error('Registration failed:', error);
      throw error;
    }
  }

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const { email, password } = credentials;

      // Find user with password and vault secrets
      const user = await User.findOne({ email: email.toLowerCase().trim() })
        .select('+password +vault.passwordSalt +vault.wrappedMDK_password +vault.wrappedMDK_securityAnswer');

      if (!user) {
        throw ApiError.unauthorized('Invalid email or password');
      }

      // Check password
      const isPasswordValid = await cryptoService.comparePassword(password, user.password);
      if (!isPasswordValid) {
        throw ApiError.unauthorized('Invalid email or password');
      }

      // --- Vault Management ---
      let needsVaultSetup = false;

      if (!user.vault || !user.vault.wrappedMDK_password) {
        needsVaultSetup = true;
      } else {
        // Standard Unlock (Universal Normalization Baseline)
        try {
          const normalizedPassword = password.toLowerCase().trim();
          const kek = await encryptionService.deriveKEK(normalizedPassword, user.vault.passwordSalt!);
          const mdk = encryptionService.unwrapKey(user.vault.wrappedMDK_password!, kek);
          await encryptionSessionService.storeMDK(user._id.toString(), mdk, user.securityConfig?.isEnabled);

          if (user.vault.wrappedMDK_securityAnswer === 'pending' || !user.vault.wrappedMDK_securityAnswer) {
            needsVaultSetup = true;
          }
        } catch (error) {
          logger.error('Login vault unlock failed', { userId: user._id, error: error.message });
        }
      }

      // Update last login
      user.lastLoginAt = new Date();
      await user.save();
      await cacheService.del(CacheKeys.userProfile(user._id.toString()));

      logger.info('User logged in successfully', { userId: user._id, email: user.email });

      // Generate tokens
      const accessToken = cryptoService.generateAccessToken({ userId: user._id.toString(), email: user.email, role: user.role });
      const refreshToken = cryptoService.generateRefreshToken({ userId: user._id.toString(), email: user.email, role: user.role });

      return {
        user: user.toJSON(),
        accessToken,
        refreshToken,
        needsVaultSetup
      };
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  async googleLogin(idToken: string): Promise<AuthResponse> {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: config.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();

      if (!payload) {
        throw ApiError.unauthorized('Invalid Google Token');
      }

      const { email, name, sub: googleId, picture } = payload;

      if (!email) {
        throw ApiError.unauthorized('Email not found in Google Token');
      }

      let user = await User.findOne({ email: email.toLowerCase().trim() })
        .select('+vault.wrappedMDK_password +vault.wrappedMDK_securityAnswer');

      if (user) {
        if (!user.googleId) {
          user.googleId = googleId;
          await user.save();
        }
      } else {
        user = new User({
          email: email.toLowerCase().trim(),
          name: name || 'User',
          googleId,
          avatar: picture,
          isEmailVerified: true,
        });
        await user.save();

        try {
          await emailService.sendWelcomeEmail(user.email, user.name);
        } catch (e) {
          logger.warn('Failed to send welcome email for Google signup', { email });
        }
      }

      const accessToken = cryptoService.generateAccessToken({ userId: user._id.toString(), email: user.email, role: user.role });
      const refreshToken = cryptoService.generateRefreshToken({ userId: user._id.toString(), email: user.email, role: user.role });

      user.lastLoginAt = new Date();
      await user.save();
      await cacheService.del(CacheKeys.userProfile(user._id.toString()));

      const needsVaultSetup = !user.vault || !user.vault.wrappedMDK_password || user.vault.wrappedMDK_securityAnswer === 'pending' || !user.vault.wrappedMDK_securityAnswer;

      return { user: user.toJSON(), accessToken, refreshToken, needsVaultSetup };
    } catch (error) {
      logger.error('Google login failed:', error);
      throw ApiError.unauthorized('Google authentication failed');
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const decoded = cryptoService.verifyRefreshToken(refreshToken);
      const user = await User.findById(decoded.userId);
      if (!user) {
        throw ApiError.unauthorized('Invalid refresh token');
      }
      const accessToken = cryptoService.generateAccessToken({ userId: user._id.toString(), email: user.email, role: user.role });
      return { accessToken };
    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw ApiError.unauthorized('Invalid refresh token');
    }
  }

  async changePassword(userId: string, passwordData: ChangePasswordRequest): Promise<void> {
    try {
      const { currentPassword, newPassword } = passwordData;
      const user = await User.findById(userId).select('+password +vault.passwordSalt +vault.wrappedMDK_password');
      if (!user) throw ApiError.notFound('User');

      const isCurrentPasswordValid = await cryptoService.comparePassword(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw ApiError.unauthorized('Current password is incorrect');
      }

      // Vault Re-wrapping
      const mdk = await encryptionSessionService.getMDK(userId);
      if (!mdk) {
        throw ApiError.forbidden('Vault is locked. Unlock vault before changing password.', 'VAULT_LOCKED');
      }

      const newPasswordSalt = crypto.randomBytes(32).toString('hex');
      const kek_new = await encryptionService.deriveKEK(newPassword, newPasswordSalt);
      const wrappedMDK_newPassword = encryptionService.wrapKey(mdk, kek_new);

      user.password = await cryptoService.hashPassword(newPassword);
      if (user.vault) {
        user.vault.passwordSalt = newPasswordSalt;
        user.vault.wrappedMDK_password = wrappedMDK_newPassword;
      }

      await user.save();
      await cacheService.del(CacheKeys.userProfile(userId));
      logger.info('Password changed successfully', { userId });
    } catch (error) {
      logger.error('Password change failed:', error);
      throw error;
    }
  }

  async getProfile(userId: string): Promise<IUser> {
    try {
      return await cacheService.getOrSet<IUser>(
        CacheKeys.userProfile(userId),
        async () => {
          const user = await User.findById(userId);
          if (!user) throw ApiError.notFound('User');
          return user.toJSON() as IUser;
        },
        15 * 60
      );
    } catch (error) {
      logger.error('Get profile failed:', error);
      throw error;
    }
  }

  async updateProfile(userId: string, updateData: Partial<IUser>): Promise<IUser> {
    try {
      const user = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true });
      if (!user) throw ApiError.notFound('User');
      await cacheService.del(CacheKeys.userProfile(userId));
      return user;
    } catch (error) {
      logger.error('Profile update failed:', error);
      throw error;
    }
  }

  async deleteAccount(userId: string): Promise<void> {
    try {
      const user = await User.findByIdAndDelete(userId);
      if (!user) throw ApiError.notFound('User');
      await cacheService.del(CacheKeys.userProfile(userId));
      await encryptionSessionService.clearMDK(userId);
    } catch (error) {
      logger.error('Account deletion failed:', error);
      throw error;
    }
  }

  async verifyEmail(otp: string): Promise<AuthResponse> {
    try {
      const otpRecord = await Otp.findOne({ otp, type: 'verification', isUsed: false, expiresAt: { $gt: new Date() } });
      if (!otpRecord) throw ApiError.unauthorized('Invalid or expired OTP');

      const user = await User.findByEmail(otpRecord.email);
      if (!user) throw ApiError.notFound('User');

      const isValid = await Otp.verifyOtp(otpRecord.email, otp, 'verification');
      if (!isValid) throw ApiError.unauthorized('Invalid OTP');

      user.isEmailVerified = true;
      user.lastLoginAt = new Date();
      await user.save();
      await cacheService.del(CacheKeys.userProfile(user._id.toString()));

      const accessToken = cryptoService.generateAccessToken({ userId: user._id.toString(), email: user.email, role: user.role });
      const refreshToken = cryptoService.generateRefreshToken({ userId: user._id.toString(), email: user.email, role: user.role });

      return { user: user.toJSON(), accessToken, refreshToken };
    } catch (error) {
      logger.error('Email verification failed:', error);
      throw error;
    }
  }

  async forgotPassword(email: string): Promise<void> {
    try {
      const user = await User.findByEmail(email);
      if (!user) return; // Silent fail

      const otp = await Otp.generateOtp(email, 'password_reset');
      await emailService.sendPasswordResetEmail(email, user.name, otp);
    } catch (error) {
      logger.error('Forgot password failed:', error);
      throw error;
    }
  }

  async resetPassword(otp: string, newPassword: string): Promise<void> {
    try {
      const otpRecord = await Otp.findOne({ otp, type: 'password_reset', isUsed: false, expiresAt: { $gt: new Date() } });
      if (!otpRecord) throw ApiError.unauthorized('Invalid or expired OTP');

      const user = await User.findByEmail(otpRecord.email);
      if (!user) throw ApiError.notFound('User');

      const isValid = await Otp.verifyOtp(otpRecord.email, otp, 'password_reset');
      if (!isValid) throw ApiError.unauthorized('Invalid OTP');

      user.password = await cryptoService.hashPassword(newPassword);
      await user.save();
      await cacheService.del(CacheKeys.userProfile(user._id.toString()));
    } catch (error) {
      logger.error('Password reset failed:', error);
      throw error;
    }
  }

  async resendVerification(email: string): Promise<void> {
    try {
      const user = await User.findByEmail(email);
      if (!user) throw ApiError.notFound('User');
      if (user.isEmailVerified) throw ApiError.conflict('Email is already verified');

      const otp = await Otp.generateOtp(email, 'verification');
      await emailService.sendVerificationEmail(email, user.name, otp);
    } catch (error) {
      logger.error('Resend verification failed:', error);
      throw error;
    }
  }

  async updateSecurityConfig(userId: string, config: SecurityConfigRequest): Promise<void> {
    try {
      const { question, answer, timeoutMinutes, isEnabled, maskEntries } = config;
      const user = await User.findById(userId).select('+password +securityConfig.answerHash +vault');
      if (!user) throw ApiError.notFound('User');

      const wasEnabled = user.securityConfig?.isEnabled;
      const isActivating = isEnabled && !wasEnabled;

      const { confirmPassword, currentAnswer } = config;

      if (wasEnabled || isActivating) {
        let isAuthorized = false;

        if (currentAnswer?.trim() && wasEnabled) {
          isAuthorized = await cryptoService.comparePassword(currentAnswer.trim().toLowerCase(), user.securityConfig!.answerHash!);
        }
        
        if (!isAuthorized && confirmPassword && wasEnabled && user.password) {
          // Fallback: reset via main account password
          isAuthorized = await cryptoService.comparePassword(confirmPassword, user.password);
        }

        if (!isAuthorized && isActivating && answer) {
          isAuthorized = true;
        }

        if (!isAuthorized) {
          logger.warn('Security update authorization failed', { 
            userId, 
            hasCurrentAnswer: !!currentAnswer, 
            hasConfirmPassword: !!confirmPassword,
            hasStoredPassword: !!user.password,
            wasEnabled 
          });
          throw ApiError.unauthorized('Invalid security answer or password confirmation');
        }

        if (isActivating && (!question || !question.trim())) {
          throw ApiError.badRequest('Security question is required when enabling security');
        }
      }

      const securityConfig: any = {
        question: question || user.securityConfig?.question,
        timeoutMinutes: timeoutMinutes ?? user.securityConfig?.timeoutMinutes ?? 5,
        isEnabled: isEnabled ?? wasEnabled ?? false,
        maskEntries: maskEntries ?? user.securityConfig?.maskEntries ?? false
      };

      if (answer && answer.trim()) {
        const normalizedAnswer = answer.trim().toLowerCase();
        
        // Sync Vault: We need the MDK to re-wrap it with the new answer
        let mdk = await encryptionSessionService.getMDK(userId);

        // If MDK not in session, try to unwrap using password if confirmed
        if (!mdk && confirmPassword && user.vault?.wrappedMDK_password) {
          try {
            const normalizedConfirm = confirmPassword.toLowerCase().trim();
            const kek = await encryptionService.deriveKEK(normalizedConfirm, user.vault.passwordSalt!);
            mdk = encryptionService.unwrapKey(user.vault.wrappedMDK_password!, kek);
          } catch (e) {
            logger.error('CRITICAL: Failed to unwrap MDK via password during security reset', { userId });
            throw ApiError.unauthorized('Unable to sync vault. Incorrect account password.');
          }
        }

        if (!mdk) {
          throw ApiError.forbidden('Vault is locked. Provide account password to sync security changes.', 'VAULT_LOCKED');
        }

        // Only update the hash if we have the MDK to update the wrapper!
        securityConfig.answerHash = await cryptoService.hashPassword(normalizedAnswer);

        if (user.vault) {
          const answerSalt = crypto.randomBytes(32).toString('hex');
          const kek = await encryptionService.deriveKEK(normalizedAnswer, answerSalt);
          const wrapped = encryptionService.wrapKey(mdk, kek);
          user.vault.securityQuestion = question || user.securityConfig?.question;
          user.vault.securityAnswerSalt = answerSalt;
          user.vault.wrappedMDK_securityAnswer = wrapped;
        }
      } else if (user.securityConfig?.answerHash) {
        securityConfig.answerHash = user.securityConfig.answerHash;
      }

      user.securityConfig = securityConfig;
      await user.save();
      await cacheService.del(CacheKeys.userProfile(userId));

      // Refresh session TTL if MDK is currently in session
      const currentMdk = await encryptionSessionService.getMDK(userId);
      if (currentMdk) {
        await encryptionSessionService.storeMDK(userId, currentMdk, user.securityConfig.isEnabled);
      }
    } catch (error) {
      logger.error('Update security config failed', error);
      throw error;
    }
  }

  async verifySecurityAnswer(userId: string, answer: string): Promise<{ valid: boolean }> {
    try {
      const user = await User.findById(userId).select('+securityConfig.answerHash');
      if (!user) throw ApiError.notFound('User');

      if (!user.securityConfig?.answerHash || !user.securityConfig.isEnabled) return { valid: false };

      const isValid = await cryptoService.comparePassword(answer.trim().toLowerCase(), user.securityConfig.answerHash);
      if (!isValid) {
        await emailService.sendSecurityAlert(user.email, user.name, answer);
      }
      return { valid: isValid };
    } catch (error) {
      logger.error('Verify security answer failed', error);
      throw error;
    }
  }

  async uploadAvatar(userId: string, file: any): Promise<IUser> {
    try {
      const user = await User.findById(userId);
      if (!user) throw ApiError.notFound('User');

      if (user.avatar) {
        try {
          const urlParts = user.avatar.split('/');
          const publicId = urlParts.slice(-2).join('/').replace(/\.[^/.]+$/, '');
          await cloudinaryService.deleteFile(publicId);
        } catch (e) { logger.warn('Old avatar delete failed', e); }
      }

      const result = await cloudinaryService.uploadFile(file, 'brinn/avatars');
      user.avatar = cloudinaryService.getOptimizedUrl(result.public_id, { width: 256, height: 256, crop: 'fill' });

      await user.save();
      await cacheService.del(CacheKeys.userProfile(userId));
      return user;
    } catch (error) {
      logger.error('Avatar upload failed', error);
      throw error;
    }
  }

  async removeAvatar(userId: string): Promise<IUser> {
    try {
      const user = await User.findById(userId);
      if (!user) throw ApiError.notFound('User');

      if (user.avatar) {
        try {
          const urlParts = user.avatar.split('/');
          const publicId = urlParts.slice(-2).join('/').replace(/\.[^/.]+$/, '');
          await cloudinaryService.deleteFile(publicId);
        } catch (e) { logger.warn('Avatar delete failed', e); }
      }

      user.avatar = undefined;
      await user.save();
      await cacheService.del(CacheKeys.userProfile(userId));
      return user;
    } catch (error) {
      logger.error('Avatar removal failed', error);
      throw error;
    }
  }

  async logout(userId: string): Promise<void> {
    try {
      await User.findByIdAndUpdate(userId, { lastLogoutAt: new Date() });
      await cacheService.del(CacheKeys.userProfile(userId));
      await encryptionSessionService.clearMDK(userId);
    } catch (error) {
      logger.error('Logout failed', error);
      throw error;
    }
  }

  async unlockVault(userId: string, data: { securityAnswer?: string; password?: string }): Promise<void> {
    return vaultService.unlockVault(userId, data);
  }

  async getVaultStatus(userId: string): Promise<VaultStatus> {
    return vaultService.getVaultStatus(userId);
  }

  async recoverVaultWithPhrase(data: VaultRecoveryRequest): Promise<void> {
    const { email, recoveryPhrase, newPassword, newSecurityQuestion, newSecurityAnswer } = data;
    return vaultService.recoverWithPhrase(email, recoveryPhrase, newPassword, newSecurityQuestion, newSecurityAnswer);
  }

  async setupVault(userId: string, data: { password?: string; securityQuestion: string; securityAnswer: string }): Promise<void> {
    const user = await User.findById(userId).select('+password');
    if (!user) throw ApiError.notFound('User');
    await vaultService.initializeVault(user as any, data);
  }
}

export const authService = new AuthService();
export default authService;
