import { Request, Response, NextFunction } from 'express';
import { CryptoHelper } from '../utils/crypto';
import { ResponseHelper } from '../utils/response';
import { AuthenticatedRequest } from '../../features/auth/auth.interfaces';
import { createUnauthorizedError, createForbiddenError } from './errorHandler';
import { logger } from '../../config/logger';

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = CryptoHelper.extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      throw createUnauthorizedError('Access token is required');
    }

    const decoded = CryptoHelper.verifyToken(token);
    
    // Add user info to request object
    req.user = {
      _id: decoded.userId as any,
      email: decoded.email,
      role: decoded.role,
    } as any;

    logger.debug('User authenticated:', {
      userId: decoded.userId,
      email: decoded.email,
    });

    next();
  } catch (error) {
    logger.error('Authentication failed:', error);
    ResponseHelper.unauthorized(res, 'Invalid or expired token');
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw createUnauthorizedError('Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw createForbiddenError('Insufficient permissions');
    }

    next();
  };
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = CryptoHelper.extractTokenFromHeader(req.headers.authorization);

    if (token) {
      const decoded = CryptoHelper.verifyToken(token);
      req.user = {
        _id: decoded.userId as any,
        email: decoded.email,
        role: decoded.role,
      } as any;
    }

    next();
  } catch (error) {
    // For optional auth, we don't throw errors, just continue without user
    next();
  }
};

export const requireEmailVerification = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    throw createUnauthorizedError('Authentication required');
  }

  if (!req.user.isEmailVerified) {
    throw createForbiddenError('Email verification required');
  }

  next();
};

export const rateLimitByUser = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next();
    }

    const userId = req.user._id.toString();
    const now = Date.now();
    const userRequests = requests.get(userId);

    if (!userRequests || now > userRequests.resetTime) {
      requests.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (userRequests.count >= maxRequests) {
      throw createForbiddenError('Rate limit exceeded');
    }

    userRequests.count++;
    next();
  };
};
