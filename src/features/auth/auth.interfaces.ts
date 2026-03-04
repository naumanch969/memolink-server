import { AuthResponse, ChangePasswordRequest, IUser, LoginRequest, RegisterRequest, RegisterResponse, SecurityConfigRequest } from "./auth.types";

export interface IAuthService {
  register(userData: RegisterRequest): Promise<RegisterResponse>;
  login(credentials: LoginRequest): Promise<AuthResponse>;
  setupVault(userId: string, data: { password?: string; securityQuestion: string; securityAnswer: string }): Promise<void>;
  refreshToken(refreshToken: string): Promise<{ accessToken: string }>;
  changePassword(userId: string, passwordData: ChangePasswordRequest): Promise<void>;
  getProfile(userId: string): Promise<IUser>;
  updateProfile(userId: string, updateData: Partial<IUser>): Promise<IUser>;
  deleteAccount(userId: string): Promise<void>;
  verifyEmail(otp: string): Promise<AuthResponse>;
  requestOnboardingOtp(email: string): Promise<{ otp?: string }>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(otp: string, newPassword: string): Promise<void>;
  resendVerification(email: string): Promise<void>;
  updateSecurityConfig(userId: string, config: SecurityConfigRequest): Promise<void>;
  verifySecurityAnswer(userId: string, answer: string): Promise<{ valid: boolean }>;
  googleLogin(idToken: string): Promise<AuthResponse>;
  logout(userId: string): Promise<void>;
  uploadAvatar(userId: string, file: any): Promise<IUser>;
  removeAvatar(userId: string): Promise<IUser>;
  unlockVault(userId: string, securityAnswer: string): Promise<void>;
  getVaultStatus(userId: string): Promise<{ isLocked: boolean; securityQuestion?: string }>;
  recoverVaultWithPhrase(email: string, recoveryPhrase: string, newPassword: string): Promise<void>;
}
