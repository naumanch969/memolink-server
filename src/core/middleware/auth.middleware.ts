import { NextFunction, Response } from 'express';
import { logger } from '../../config/logger';
import User from '../../features/auth/auth.model';
import { AuthenticatedRequest } from '../../features/auth/auth.types';
import { CacheKeys } from '../cache/cache.keys';
import { cacheService } from '../cache/cache.service';
import { cryptoService } from '../crypto/crypto.service';
import { ApiError } from '../errors/api.error';
import { ResponseHelper } from '../utils/response.utils';

export class AuthMiddleware {
  static authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {

      const token = cryptoService.extractTokenFromHeader(req.headers.authorization);

      if (!token) {
        throw ApiError.unauthorized('Access token is required');
      }

      const decoded = cryptoService.verifyToken(token);

      // Fetch full profile from cache or database
      const userProfile = await cacheService.getOrSet(
        CacheKeys.userProfile(decoded.userId),
        async () => {
          const user = await User.findById(decoded.userId);
          if (!user) {
            throw ApiError.unauthorized('User not found');
          }
          return user.toJSON();
        },
        15 * 60 // 15 minutes TTL
      );

      // Add user info to request object
      req.user = userProfile as any;

      logger.debug('User authenticated:', { userId: decoded.userId, email: decoded.email, });

      next();
    } catch (error) {
      logger.error('Authentication failed:', error);
      ResponseHelper.unauthorized(res, 'Invalid or expired token');
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
}


