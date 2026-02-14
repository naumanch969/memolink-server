import { NextFunction, Request, Response } from 'express';
import { config } from '../../config/env';
import { logger } from '../../config/logger';
import { HTTP_STATUS } from '../../shared/constants';
import { Helpers } from '../../shared/helpers';
import { ApiError, IAppError } from '../errors/api.error';
import { ResponseHelper } from '../utils/response.util';

/**
 * Express Error Handling Middleware
 */

export class ErrorMiddleware {
    // Global error handler
    public static handle(error: IAppError, req: Request, res: Response, _next: NextFunction): void {
        let { statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, message } = error;

        // Log error details
        logger.error('API Error:', {
            message: error.message,
            stack: error.stack,
            url: req.url,
            method: req.method,
            ip: req.ip,
        });

        // Handle Mongoose/Mongo specific errors
        if (Helpers.isMongoError(error)) {
            statusCode = HTTP_STATUS.BAD_REQUEST;
            message = Helpers.getMongoErrorMessage(error);
        }

        // Handle Validation errors
        if (error.name === 'ValidationError') {
            statusCode = HTTP_STATUS.UNPROCESSABLE_ENTITY;
            message = 'Validation failed';
        }

        // Handle Identity/Token errors
        if (error.name === 'JsonWebTokenError') {
            statusCode = HTTP_STATUS.UNAUTHORIZED;
            message = 'Invalid token';
        }

        if (error.name === 'TokenExpiredError') {
            statusCode = HTTP_STATUS.UNAUTHORIZED;
            message = 'Token expired';
        }

        // Handle Cast errors (Invalid MongoDB IDs)
        if (error.name === 'CastError') {
            statusCode = HTTP_STATUS.BAD_REQUEST;
            message = 'Invalid resource ID format';
        }

        // Operational safety check for production
        if (config.NODE_ENV === 'production' && !error.isOperational) {
            message = 'An unexpected error occurred';
        }

        ResponseHelper.error(
            res,
            message,
            statusCode,
            config.NODE_ENV === 'development' ? error : undefined
        );
    }

    // 404 Route Not Found handler
    public static notFound(req: Request, _res: Response, next: NextFunction): void {
        const error = ApiError.notFound(`Route ${req.originalUrl}`);
        next(error);
    }
}
