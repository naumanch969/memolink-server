import { NextFunction, Request, Response } from 'express';
import { config } from '../../config/env';
import { logger } from '../../config/logger';
import { redisConnection } from '../../config/redis';
import { MetricsService } from '../../features/monitoring/metrics.service';
import { cryptoService } from '../crypto/crypto.service';
import { ResponseHelper } from '../utils/response.utils';
import { USER_ROLES } from '../../shared/constants';
import { IUser } from '../../features/auth/auth.types';

export class RateLimitMiddleware {
    /**
     * Basic Redis-backed Rate Limiter
     * Tracks requests by User ID (if authenticated) or IP address.
     * Fails open if Redis is unavailable to ensure service continuity.
     */
    static limit(options: {
        windowMs?: number;
        maxRequests?: number;
        zone?: string;
    } = {}) {
        const windowMs = options.windowMs || config.RATE_LIMIT_WINDOW_MS;
        const zone = options.zone || 'global';

        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                // Skip rate limiting in test environment if needed
                if (config.NODE_ENV === 'test') return next();

                let userId = (req as any).user?._id?.toString();
                const user: IUser | undefined = (req as any).user;
                let userRole = user?.role;

                if (!userId) {
                    const token = cryptoService.extractTokenFromHeader(req.headers.authorization);
                    if (token) {
                        try {
                            const decoded = cryptoService.verifyToken(token);
                            userId = decoded.userId;
                            userRole = (decoded as any).role;
                        } catch (e) {
                            // Invalid token, fallback to IP
                        }
                    }
                }

                // Determine applicable limit
                const isSystem = userRole === USER_ROLES.ADMIN;
                const maxRequests = options.maxRequests || 
                    (isSystem ? config.RATE_LIMIT_MAX_REQUESTS : config.USER_RATE_LIMIT_MAX_REQUESTS);

                const identifier = userId || req.ip;
                const redisKey = `rl:${identifier}:${zone}`;

                // Atomic increment and expiry set
                const current = await (redisConnection as any).rateLimit(redisKey, windowMs);

                // Set standard rate limit headers
                const remaining = Math.max(0, maxRequests - current);
                res.setHeader('X-RateLimit-Limit', maxRequests);
                res.setHeader('X-RateLimit-Remaining', remaining);

                // If exceeded, block request
                if (current > maxRequests) {
                    logger.warn('Rate limit exceeded', {
                        identifier,
                        zone,
                        path: req.path,
                        ip: req.ip
                    });

                    // Track rate limit hits for monitoring
                    MetricsService.increment(`ratelimit:hit:${zone}`);

                    const ttl = await redisConnection.pttl(redisKey);
                    if (ttl > 0) {
                        res.setHeader('Retry-After', Math.ceil(ttl / 1000));
                    }

                    return ResponseHelper.tooManyRequests(res, 'Too many requests, please try again later.');
                }

                next();
            } catch (error) {
                // BASIC RATE LIMITING RULE: Don't kill the server if Redis fails
                logger.error('Rate limiting error - failing open:', error);
                next();
            }
        };
    }
}
