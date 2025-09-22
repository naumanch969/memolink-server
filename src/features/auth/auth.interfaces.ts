import { IUser } from '../../shared/types';

export interface AuthResponse {
  user: Omit<IUser, 'password'>;
  accessToken: string;
  refreshToken: string;
}

export interface IAuthService {
  register(userData: RegisterRequest): Promise<AuthResponse>;
  login(credentials: LoginRequest): Promise<AuthResponse>;
  refreshToken(refreshToken: string): Promise<{ accessToken: string }>;
  changePassword(userId: string, passwordData: ChangePasswordRequest): Promise<void>;
  getProfile(userId: string): Promise<IUser>;
  updateProfile(userId: string, updateData: Partial<IUser>): Promise<IUser>;
  deleteAccount(userId: string): Promise<void>;
  verifyEmail(token: string): Promise<void>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;
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
  token: string;
  newPassword: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ResendVerificationRequest {
  email: string;
}
