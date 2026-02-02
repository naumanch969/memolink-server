import { Request } from 'express';
import { BaseEntity } from '../../shared/types';

// User Types
export interface IUser extends BaseEntity {
  email: string;
  password?: string;
  googleId?: string;
  name: string;
  avatar?: string;
  role: string;
  isEmailVerified: boolean;
  isActive: boolean;
  lastLoginAt?: Date;
  lastLogoutAt?: Date;
  preferences: {
    theme: 'light' | 'dark' | 'auto' | 'system';
    notifications: boolean;
    privacy: 'public' | 'private';
    communication?: {
      newsletter: boolean;
      productUpdates: boolean;
      security: boolean;
    };
  };
  securityConfig?: {
    question: string;
    answerHash: string; // Hashed answer
    timeoutMinutes: number; // e.g. 5, 15, 30
    isEnabled: boolean;
    maskEntries?: boolean;
  };
  // Storage quota tracking
  storageUsed: number; // bytes
  storageQuota: number; // bytes (default from STORAGE_LIMITS)
}

// Request Types
export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

// OTP Types
export interface IOtp extends BaseEntity {
  email: string;
  otp: string;
  type: 'verification' | 'password_reset';
  expiresAt: Date;
  isUsed: boolean;
  attempts: number;
}

// JWT Payload
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  user: Omit<IUser, 'password'>;
  accessToken: string;
  refreshToken: string;
  otp?: string; // For development environment
}

export interface IAuthService {
  register(userData: RegisterRequest): Promise<{ otp?: string }>;
  login(credentials: LoginRequest): Promise<AuthResponse>;
  refreshToken(refreshToken: string): Promise<{ accessToken: string }>;
  changePassword(userId: string, passwordData: ChangePasswordRequest): Promise<void>;
  getProfile(userId: string): Promise<IUser>;
  updateProfile(userId: string, updateData: Partial<IUser>): Promise<IUser>;
  deleteAccount(userId: string): Promise<void>;
  verifyEmail(otp: string): Promise<void>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(otp: string, newPassword: string): Promise<void>;
  resendVerification(email: string): Promise<void>;
  updateSecurityConfig(userId: string, config: SecurityConfigRequest): Promise<void>;
  verifySecurityAnswer(userId: string, answer: string): Promise<{ valid: boolean }>;
  googleLogin(idToken: string): Promise<AuthResponse>;
  logout(userId: string): Promise<void>;
}

export interface GoogleLoginRequest {
  idToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  otp: string;
  newPassword: string;
}

export interface VerifyEmailRequest {
  otp: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface SecurityConfigRequest {
  question: string;
  answer: string;
  timeoutMinutes: number;
  isEnabled: boolean;
  maskEntries?: boolean;
}
