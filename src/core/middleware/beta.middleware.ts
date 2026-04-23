
import { Request, Response, NextFunction } from 'express';
import { USER_ROLES } from '../../shared/constants';
import ApiError from '../utils/ApiError';

/**
 * Middleware to restrict access to Beta Testers and Admins only.
 * Useful for gating features that are in active development or 
 * not yet ready for the general public.
 */
export const betaOnly = (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole) {
        return next(ApiError.unauthorized('Authentication required for beta features'));
    }

    if (userRole === USER_ROLES.BETA_TESTER || userRole === USER_ROLES.ADMIN) {
        return next();
    }

    next(ApiError.forbidden('This feature is currently available to Beta Testers only. Join our beta program to get early access.', 'BETA_ONLY'));
};
