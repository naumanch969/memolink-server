import { NextFunction, Request, Response } from 'express';
import multer, { Field } from 'multer';
import { config } from '../../config/env';
import { logger } from '../../config/logger';
import { FILE_UPLOAD } from '../../shared/constants';
import { ApiError } from '../errors/api.error';
import { getExtensionFromMimeType, validateFileMagicBytes } from '../utils/file-validator.util';

export class FileUploadMiddleware {
  // Multer memory storage
  private static readonly storage = multer.memoryStorage();

  // File filter (MIME validation)
  private static fileFilter: multer.Options['fileFilter'] = (
    req: Request,
    file: Express.Multer.File,
    cb
  ) => {
    const allowedTypes = [
      ...FILE_UPLOAD.ALLOWED_IMAGE_TYPES,
      ...FILE_UPLOAD.ALLOWED_VIDEO_TYPES,
      ...FILE_UPLOAD.ALLOWED_DOCUMENT_TYPES,
      ...FILE_UPLOAD.ALLOWED_ARCHIVE_TYPES,
      ...FILE_UPLOAD.ALLOWED_DATA_TYPES,
      ...FILE_UPLOAD.ALLOWED_CODE_TYPES,
    ];

    if (allowedTypes.includes(file.mimetype as any)) {
      cb(null, true);
    } else {
      cb(ApiError.badRequest(`File type ${file.mimetype} is not allowed`));
    }
  };

  // Multer instance
  private static readonly upload = multer({
    storage: FileUploadMiddleware.storage,
    fileFilter: FileUploadMiddleware.fileFilter,
    limits: {
      fileSize: config.MAX_FILE_SIZE,
      files: 5,
    },
  });

  // Single file upload
  static uploadSingle(fieldName: string = 'file') {
    return this.upload.single(fieldName);
  }

  // Multiple file upload
  static uploadMultiple(fieldName: string = 'files', maxCount: number = 5) {
    return this.upload.array(fieldName, maxCount);
  }

  // Mixed fields upload
  static uploadFields(fields: Field[]) {
    return this.upload.fields(fields);
  }

  // Magic byte validation middleware
  static validateFileContent(req: Request, res: Response, next: NextFunction) {
    const file = req.file;

    if (!file) {
      return next();
    }

    const validation = validateFileMagicBytes(file.buffer, file.mimetype);

    if (!validation.valid) {
      logger.warn('File content validation failed', {
        originalName: file.originalname,
        declaredType: file.mimetype,
        detectedType: validation.detectedType,
      });

      return res.status(400).json({
        success: false,
        error: validation.error || 'File content does not match declared type',
      });
    }

    (file as any).extension = getExtensionFromMimeType(file.mimetype);

    next();
  }
}
