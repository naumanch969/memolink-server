import { NextFunction, Response } from 'express';
import { logger } from '../../config/logger';
import User from '../../features/auth/auth.model';
import { AuthenticatedRequest } from '../../features/auth/auth.types';
import { CacheKeys } from '../cache/cache.keys';
import { cacheService } from '../cache/cache.service';
import { cryptoService } from '../crypto/crypto.service';
import encryptionSessionService from '../encryption/encryption-session.service';
import { ApiError } from '../errors/api.error';
import { ResponseHelper } from '../utils/response.utils';

export class AuthMiddleware {
  static authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {

      const token = cryptoService.extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        throw ApiError.unauthorized('Access token is required');
      }

      let authUserId: string;
      let grantId: string | undefined;
      let grantSecret: string | undefined;

      // Check if it's an API Key or a JWT Token
      const IS_API_KEY = token.startsWith('mclk_');

      if (IS_API_KEY) {
        logger.info('Handling as Persistent API Key');
        // Handle persistent API Key
        const { apiKeyService } = await import('../../features/api-key/api-key.service');
        const resolvedUserId = await apiKeyService.verifyAndGetUser(token);

        if (!resolvedUserId) {
          throw ApiError.unauthorized('Invalid or revoked API Key');
        }
        authUserId = resolvedUserId.toString();

      } else {
        // Handle traditional JWT
        const decoded = cryptoService.verifyToken(token);
        authUserId = decoded.userId;
        grantId = decoded.gid;
        grantSecret = decoded.ks;
      }

      // Fetch full profile from cache or database
      const userProfile = await cacheService.getOrSet(
        CacheKeys.userProfile(authUserId),
        async () => {
          const user = await User.findById(authUserId);
          if (!user) {
            throw ApiError.unauthorized('User not found');
          }
          return user.toJSON();
        },
        15 * 60 // 15 minutes TTL
      );

      // If it's an OAuth token with a grant secret, automatically unseal the vault
      if (grantId && grantSecret) {
        const mdkInSession = await encryptionSessionService.getMDK(authUserId);
        if (!mdkInSession) {
          const { OAuthGrant } = await import('../../features/oauth/oauth-grant.model');
          const { vaultService } = await import('../../features/auth/vault.service');

          const grant = await OAuthGrant.findById(grantId);
          if (grant && !grant.revokedAt) {
            try {
              const mdk = await vaultService.unwrapMDKFromGrant(grant.wrappedMDK, grant.vaultSalt, grantSecret);
              const isLockEnabled = (userProfile as any).securityConfig?.isEnabled ?? true;
              await encryptionSessionService.storeMDK(authUserId, mdk, isLockEnabled);

              // Update last used (async, don't block)
              OAuthGrant.updateOne({ _id: grantId }, { lastUsedAt: new Date() }).catch(err => logger.error('Grant update error', err));
            } catch (err) {
              logger.warn('Failed to unseal vault using OAuth grant secret', { grantId });
            }
          }
        }
      }

      // Add user info to request object
      req.user = userProfile as any;

      logger.debug('User authenticated:', { userId: authUserId });

      // Refresh Vault TTL (sliding window)
      if (authUserId) {
        const isLockEnabled = (userProfile as any).securityConfig?.isEnabled ?? true;
        await encryptionSessionService.refreshMDK(authUserId, isLockEnabled);
      }

      next();
    } catch (error: any) {
      // Don't flood logs with 'expired' or 'invalid' token errors as these are normal events
      if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
        logger.warn('Authentication failed:', { message: error.message, url: req.url });
      } else {
        logger.error('Authentication system error:', error);
      }

      ResponseHelper.unauthorized(res, 'Invalid or expired token/key');
    }
  };

  static authorize = (...roles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      if (!roles.includes(req.user.role)) {
        throw ApiError.forbidden('Insufficient permissions');
      }

      next();
    };
  };

  /**
   * Middleware to ensure the Encryption Vault is unlocked.
   * Required for operations that need the Master Data Key (MDK).
   */
  static requireVault = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const mdk = await encryptionSessionService.getMDK(req.user._id.toString());
      if (!mdk) {
        // We throw a specific error that the frontend can catch to show the lock screen
        throw ApiError.forbidden('Vault is locked. Please unlock to proceed.', 'VAULT_LOCKED');
      }

      next();
    } catch (error) {
      if (error instanceof ApiError && error.errorCode === 'VAULT_LOCKED') {
        ResponseHelper.error(res, error.message, error.statusCode, { errorCode: 'VAULT_LOCKED' });
      } else {
        ResponseHelper.error(res, 'Vault access denied', 403);
      }
    }
  };
}


