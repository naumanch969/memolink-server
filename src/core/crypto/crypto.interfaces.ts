import { JWTPayload } from '../../features/auth/auth.types';

export interface ICryptoService {
    hashPassword(password: string): Promise<string>;
    comparePassword(password: string, hashedPassword: string): Promise<boolean>;
    generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string;
    generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string;
    verifyToken(token: string): JWTPayload;
    verifyRefreshToken(token: string): JWTPayload;
    extractTokenFromHeader(authHeader: string | undefined): string | null;
    generateRandomToken(length?: number): string;
    generateSecureRandomString(length?: number): string;
    generateVerificationCode(length?: number): string;
    hashSensitiveData(data: string): string;
}
