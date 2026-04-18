import { Request } from 'express';
import { BaseEntity } from "../../shared/types";

export interface IUser extends BaseEntity {
    email: string;
    password?: string;
    googleId?: string;
    name: string;
    avatar?: string;
    role: string;
    whatsappNumber?: string;
    whatsappLinkingCode?: string;
    whatsappLinkingCodeExpires?: Date;
    isEmailVerified: boolean;
    isOnboarded: boolean;
    isActive: boolean;
    interests?: string[];
    lastLoginAt?: Date;
    lastLogoutAt?: Date;
    preferences: {
        theme: 'light' | 'dark' | 'auto' | 'system';
        notifications: boolean;
        privacy: 'public' | 'private';
        webActivityTrackingEnabled: boolean;
        webActivityAutoClassification: boolean;
        accentColor?: 'zinc' | 'red' | 'rose' | 'orange' | 'green' | 'blue' | 'yellow' | 'violet';
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
    storageUsed: number;
    storageQuota: number;
    pushTokens?: {
        token: string;
        platform: string;
        createdAt: Date;
    }[];
    vault?: {
        passwordSalt: string;
        wrappedMDK_password: string;
        securityQuestion: string;
        securityAnswerSalt: string;
        wrappedMDK_securityAnswer: string;
        recoverySalt: string;
        wrappedMDK_recovery: string;
        encryptionVersion: number;
        unlockAttempts?: number;
        unlockLockedUntil?: Date;
    };
}

export interface AuthenticatedRequest extends Request {
    user?: IUser;
}

export interface IOtp extends BaseEntity {
    email: string;
    otp: string;
    type: 'verification' | 'password_reset';
    expiresAt: Date;
    isUsed: boolean;
    attempts: number;
}

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
    otp?: string;
    recoveryPhrase?: string;
    needsVaultSetup?: boolean;
}

export interface RegisterResponse {
    otp?: string;
    recoveryPhrase?: string;
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
    securityQuestion: string;
    securityAnswer: string;
}

export interface VaultUnlockRequest {
    securityAnswer?: string;
    password?: string;
}

export interface VaultStatus {
    isLocked: boolean;
    securityQuestion?: string;
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

export interface VaultRecoveryRequest {
    email: string;
    recoveryPhrase: string;
    newPassword?: string;
    newSecurityQuestion?: string;
    newSecurityAnswer?: string;
}
