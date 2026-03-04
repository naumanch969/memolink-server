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
    public readonly errorCode?: string;

    constructor(
        message: string,
        statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
        errorCode?: string,
        isOperational: boolean = true
    ) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.isOperational = isOperational;

        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Factory methods for common errors
     */
    public static internal(message: string = 'Internal Server Error', isOperational: boolean = false): ApiError {
        return new ApiError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, undefined, isOperational);
    }

    public static badRequest(message: string, errorCode?: string): ApiError {
        return new ApiError(message, HTTP_STATUS.BAD_REQUEST, errorCode);
    }

    public static unauthorized(message: string = 'Unauthorized', errorCode?: string): ApiError {
        return new ApiError(message, HTTP_STATUS.UNAUTHORIZED, errorCode);
    }

    public static forbidden(message: string = 'Forbidden', errorCode?: string): ApiError {
        return new ApiError(message, HTTP_STATUS.FORBIDDEN, errorCode);
    }

    public static notFound(resource: string = 'Resource', errorCode?: string): ApiError {
        return new ApiError(`${resource} not found`, HTTP_STATUS.NOT_FOUND, errorCode);
    }

    public static conflict(message: string, errorCode?: string): ApiError {
        return new ApiError(message, HTTP_STATUS.CONFLICT, errorCode);
    }

    public static unprocessable(message: string = 'Validation failed', errorCode?: string): ApiError {
        return new ApiError(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, errorCode);
    }
}
