import { AuthResponse, ChangePasswordRequest, IUser, LoginRequest, RegisterRequest, SecurityConfigRequest } from "./auth.types";

// User Types
// Request Types
// OTP Types
// JWT Payload

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
