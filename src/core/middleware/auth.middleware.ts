import { NextFunction, Response } from 'express';
import { logger } from '../../config/logger';
import { AuthenticatedRequest } from '../../features/auth/auth.interfaces';
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

      // Add user info to request object
      req.user = {
        _id: decoded.userId as any,
        email: decoded.email,
        role: decoded.role,
      } as any;

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


