/**
 * CDN URL Signing Service
 * 
 * Provides secure, time-limited URLs for protected media access.
 * Supports:
 * - Signed URLs with expiration
 * - Token-based access
 * - IP-restricted access
 */

import crypto from 'crypto';
import { config } from '../../config/env';
import { logger } from '../../config/logger';

// Signing configuration
const SIGNING_CONFIG = {
  algorithm: 'sha256',
  defaultExpiry: 3600, // 1 hour
  maxExpiry: 86400, // 24 hours
  tokenParamName: '_token',
  expiryParamName: '_expires',
};

export interface SignedUrlOptions {
  expiresInSeconds?: number;
  restrictIp?: string;
  userId?: string;
  mediaId?: string;
}

export interface SignedUrlResult {
  url: string;
  expiresAt: Date;
  token: string;
}

export interface TokenValidation {
  valid: boolean;
  expired?: boolean;
  reason?: string;
}

/**
 * CDN URL Signing Service
 */
class CdnUrlSigningService {
  private signingKey: string;

  constructor() {
    // Use Cloudinary API secret or a dedicated signing key
    this.signingKey = config.CLOUDINARY_API_SECRET || 'default-signing-key';
    
    if (!config.CLOUDINARY_API_SECRET) {
      logger.warn('CDN URL signing using default key - configure CLOUDINARY_API_SECRET for security');
    }
  }

  /**
   * Generate a signed URL with expiration
   */
  signUrl(url: string, options: SignedUrlOptions = {}): SignedUrlResult {
    const {
      expiresInSeconds = SIGNING_CONFIG.defaultExpiry,
      restrictIp,
      userId,
      mediaId,
    } = options;

    // Clamp expiry to max
    const expiry = Math.min(expiresInSeconds, SIGNING_CONFIG.maxExpiry);
    const expiresAt = new Date(Date.now() + expiry * 1000);
    const expiresTimestamp = Math.floor(expiresAt.getTime() / 1000);

    // Build payload to sign
    const payload = [
      url,
      expiresTimestamp.toString(),
      restrictIp || '',
      userId || '',
      mediaId || '',
    ].join('|');

    // Generate signature
    const token = this.generateToken(payload);

    // Build signed URL
    const separator = url.includes('?') ? '&' : '?';
    const signedUrl = `${url}${separator}${SIGNING_CONFIG.expiryParamName}=${expiresTimestamp}&${SIGNING_CONFIG.tokenParamName}=${token}`;

    logger.debug('Signed URL generated', {
      originalUrl: url.substring(0, 50),
      expiresAt,
    });

    return {
      url: signedUrl,
      expiresAt,
      token,
    };
  }

  /**
   * Validate a signed URL
   */
  validateSignedUrl(
    url: string,
    options: {
      clientIp?: string;
      userId?: string;
      mediaId?: string;
    } = {}
  ): TokenValidation {
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;

      // Extract token and expiry
      const token = params.get(SIGNING_CONFIG.tokenParamName);
      const expiresStr = params.get(SIGNING_CONFIG.expiryParamName);

      if (!token || !expiresStr) {
        return { valid: false, reason: 'Missing token or expiry' };
      }

      const expiresTimestamp = parseInt(expiresStr, 10);
      if (isNaN(expiresTimestamp)) {
        return { valid: false, reason: 'Invalid expiry format' };
      }

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (now > expiresTimestamp) {
        return { valid: false, expired: true, reason: 'URL has expired' };
      }

      // Reconstruct original URL for validation
      params.delete(SIGNING_CONFIG.tokenParamName);
      params.delete(SIGNING_CONFIG.expiryParamName);
      const originalUrl = `${urlObj.origin}${urlObj.pathname}${params.toString() ? '?' + params.toString() : ''}`;

      // Rebuild payload
      const payload = [
        originalUrl,
        expiresTimestamp.toString(),
        options.clientIp || '',
        options.userId || '',
        options.mediaId || '',
      ].join('|');

      // Verify signature
      const expectedToken = this.generateToken(payload);
      if (token !== expectedToken) {
        // Try without IP restriction (in case IP changed)
        const payloadNoIp = [
          originalUrl,
          expiresTimestamp.toString(),
          '',
          options.userId || '',
          options.mediaId || '',
        ].join('|');
        const tokenNoIp = this.generateToken(payloadNoIp);
        
        if (token !== tokenNoIp) {
          return { valid: false, reason: 'Invalid signature' };
        }
      }

      return { valid: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Validation error';
      logger.error('URL validation failed', { error: msg });
      return { valid: false, reason: msg };
    }
  }

  /**
   * Generate a simple access token for a media item
   */
  generateAccessToken(mediaId: string, userId: string, expiresInSeconds: number = 3600): string {
    const expiry = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const payload = `${mediaId}|${userId}|${expiry}`;
    const signature = this.generateToken(payload);
    
    // Encode as base64 for URL safety
    const tokenData = Buffer.from(`${expiry}:${signature}`).toString('base64url');
    
    return tokenData;
  }

  /**
   * Validate an access token
   */
  validateAccessToken(token: string, mediaId: string, userId: string): TokenValidation {
    try {
      const decoded = Buffer.from(token, 'base64url').toString();
      const [expiryStr, signature] = decoded.split(':');
      
      const expiry = parseInt(expiryStr, 10);
      if (isNaN(expiry)) {
        return { valid: false, reason: 'Invalid token format' };
      }

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (now > expiry) {
        return { valid: false, expired: true, reason: 'Token has expired' };
      }

      // Verify signature
      const payload = `${mediaId}|${userId}|${expiry}`;
      const expectedSignature = this.generateToken(payload);

      if (signature !== expectedSignature) {
        return { valid: false, reason: 'Invalid token signature' };
      }

      return { valid: true };
    } catch {
      return { valid: false, reason: 'Token validation failed' };
    }
  }

  /**
   * Sign Cloudinary URL using their transformation signature
   */
  signCloudinaryUrl(
    publicId: string,
    transformations: string = '',
    expiresInSeconds: number = 3600
  ): string {
    const cloudName = config.CLOUDINARY_CLOUD_NAME;
    const apiSecret = config.CLOUDINARY_API_SECRET;
    
    if (!cloudName || !apiSecret) {
      throw new Error('Cloudinary not configured for URL signing');
    }

    const timestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    
    // Cloudinary signed URL format
    const toSign = transformations 
      ? `${transformations}/${publicId}${timestamp}${apiSecret}`
      : `${publicId}${timestamp}${apiSecret}`;
    
    const signature = crypto
      .createHash('sha1')
      .update(toSign)
      .digest('hex')
      .substring(0, 8);

    const baseUrl = `https://res.cloudinary.com/${cloudName}/image/upload`;
    const signedUrl = transformations
      ? `${baseUrl}/s--${signature}--/${transformations}/${publicId}`
      : `${baseUrl}/s--${signature}--/${publicId}`;

    return signedUrl;
  }

  /**
   * Generate HMAC token
   */
  private generateToken(payload: string): string {
    return crypto
      .createHmac(SIGNING_CONFIG.algorithm, this.signingKey)
      .update(payload)
      .digest('hex');
  }
}

// Export singleton instance
export const cdnUrlSigningService = new CdnUrlSigningService();
