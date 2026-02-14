import { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { HTTP_STATUS } from '../../shared/constants';
import { ResponseHelper } from '../utils/response.util';

export class ValidationMiddleware {

  static validate(req: Request, res: Response, next: NextFunction): void {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined,
      }));

      ResponseHelper.error(
        res,
        'Validation failed',
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        { errors: errorMessages }
      );
      return;
    }

    next();
  }

}

