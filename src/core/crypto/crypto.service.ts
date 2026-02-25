import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env';
import { JWTPayload } from '../../features/auth/auth.types';

import { ICryptoService } from './crypto.interfaces';

export class CryptoService implements ICryptoService {
  // Password hashing
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.BCRYPT_ROUNDS);
  }

  async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  // JWT token generation
  generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN,
    });
  }

  generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_REFRESH_EXPIRES_IN,
    });
  }

  // JWT token verification
  verifyToken(token: string): JWTPayload {
    return jwt.verify(token, config.JWT_SECRET) as JWTPayload;
  }

  verifyRefreshToken(token: string): JWTPayload {
    return jwt.verify(token, config.JWT_SECRET) as JWTPayload;
  }

  // Token extraction from headers
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) return null;

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

    return parts[1];
  }

  // Generate random tokens
  generateRandomToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Generate secure random string
  generateSecureRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate verification code
  generateVerificationCode(length: number = 6): string {
    const chars = '0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Hash sensitive data (for logging purposes)
  hashSensitiveData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 8);
  }
}

export const cryptoService = new CryptoService();
export default CryptoService;
