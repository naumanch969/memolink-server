import { Response } from 'express';
import { HTTP_STATUS } from '../../shared/constants';
import { ApiResponse, PaginationMeta } from '../../shared/types';


export class ResponseHelper {

  static success<T>(
    res: Response,
    data?: T,
    message: string = 'Success',
    statusCode: number = HTTP_STATUS.OK,
    meta?: PaginationMeta
  ): Response {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data,
      meta,
    };

    return res.status(statusCode).json(response);
  }

  static created<T>(
    res: Response,
    data?: T,
    message: string = 'Resource created successfully'
  ): Response {
    return this.success(res, data, message, HTTP_STATUS.CREATED);
  }

  static noContent(res: Response, message: string = 'No content'): Response {
    return this.success(res, undefined, message, HTTP_STATUS.NO_CONTENT);
  }

  static error(
    res: Response,
    message: string = 'Internal server error',
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    error?: any
  ): Response {
    const response: ApiResponse = {
      success: false,
      message,
      error: error?.message || error,
    };

    return res.status(statusCode).json(response);
  }

  static badRequest(
    res: Response,
    message: string = 'Bad request',
    error?: any
  ): Response {
    return this.error(res, message, HTTP_STATUS.BAD_REQUEST, error);
  }

  static unauthorized(
    res: Response,
    message: string = 'Unauthorized',
    error?: any
  ): Response {
    return this.error(res, message, HTTP_STATUS.UNAUTHORIZED, error);
  }

  static forbidden(
    res: Response,
    message: string = 'Forbidden',
    error?: any
  ): Response {
    return this.error(res, message, HTTP_STATUS.FORBIDDEN, error);
  }

  static notFound(
    res: Response,
    message: string = 'Resource not found',
    error?: any
  ): Response {
    return this.error(res, message, HTTP_STATUS.NOT_FOUND, error);
  }

  static conflict(
    res: Response,
    message: string = 'Resource already exists',
    error?: any
  ): Response {
    return this.error(res, message, HTTP_STATUS.CONFLICT, error);
  }

  static unprocessableEntity(
    res: Response,
    message: string = 'Validation failed',
    error?: any
  ): Response {
    return this.error(res, message, HTTP_STATUS.UNPROCESSABLE_ENTITY, error);
  }

  static paginated<T>(
    res: Response,
    data: T[],
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    },
    message: string = 'Success'
  ): Response {
    return this.success(res, data, message, HTTP_STATUS.OK, meta);
  }
}

export default ResponseHelper;
