import { HTTP_STATUS } from '../../shared/constants';

/**
 * Standard interface for Application Errors
 */
export interface IAppError extends Error {
    statusCode?: number;
    isOperational?: boolean;
}

/**
 * Custom API Error class for operational errors
 */

export class ApiError extends Error implements IAppError {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(
        message: string,
        statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
        isOperational: boolean = true
    ) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.isOperational = isOperational;

        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Factory methods for common errors
     */
    public static internal(message: string = 'Internal Server Error', isOperational: boolean = false): ApiError {
        return new ApiError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, isOperational);
    }

    public static badRequest(message: string): ApiError {
        return new ApiError(message, HTTP_STATUS.BAD_REQUEST);
    }

    public static unauthorized(message: string = 'Unauthorized'): ApiError {
        return new ApiError(message, HTTP_STATUS.UNAUTHORIZED);
    }

    public static forbidden(message: string = 'Forbidden'): ApiError {
        return new ApiError(message, HTTP_STATUS.FORBIDDEN);
    }

    public static notFound(resource: string = 'Resource'): ApiError {
        return new ApiError(`${resource} not found`, HTTP_STATUS.NOT_FOUND);
    }

    public static conflict(message: string): ApiError {
        return new ApiError(message, HTTP_STATUS.CONFLICT);
    }

    public static unprocessable(message: string = 'Validation failed'): ApiError {
        return new ApiError(message, HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }
}
