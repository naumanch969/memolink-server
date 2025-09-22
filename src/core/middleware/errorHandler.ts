import { Request, Response, NextFunction } from 'express';
import { ResponseHelper } from '../utils/response';
import { logger } from '../../config/logger';
import { HTTP_STATUS } from '../../shared/constants';
import { Helpers } from '../../shared/helpers';
import { config } from '../../config/env';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let { statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, message } = error;

  // Log error
  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Handle specific error types
  if (Helpers.isMongoError(error)) {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = Helpers.getMongoErrorMessage(error);
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    statusCode = HTTP_STATUS.UNPROCESSABLE_ENTITY;
    message = 'Validation failed';
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    message = 'Invalid token';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    message = 'Token expired';
  }

  // Handle cast errors
  if (error.name === 'CastError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = 'Invalid ID format';
  }

  // Don't leak error details in production
  if (config.NODE_ENV === 'production' && !error.isOperational) {
    message = 'Something went wrong';
  }

  ResponseHelper.error(res, message, statusCode, config.NODE_ENV === 'development' ? error : undefined);
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new CustomError(`Route ${req.originalUrl} not found`, HTTP_STATUS.NOT_FOUND);
  next(error);
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const createError = (message: string, statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR): CustomError => {
  return new CustomError(message, statusCode);
};

export const createValidationError = (message: string): CustomError => {
  return new CustomError(message, HTTP_STATUS.UNPROCESSABLE_ENTITY);
};

export const createNotFoundError = (resource: string): CustomError => {
  return new CustomError(`${resource} not found`, HTTP_STATUS.NOT_FOUND);
};

export const createUnauthorizedError = (message: string = 'Unauthorized'): CustomError => {
  return new CustomError(message, HTTP_STATUS.UNAUTHORIZED);
};

export const createForbiddenError = (message: string = 'Forbidden'): CustomError => {
  return new CustomError(message, HTTP_STATUS.FORBIDDEN);
};

export const createConflictError = (message: string): CustomError => {
  return new CustomError(message, HTTP_STATUS.CONFLICT);
};
