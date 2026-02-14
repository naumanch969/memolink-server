import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { config } from '../../config/env';
import { logger } from '../../config/logger';
import { FILE_UPLOAD } from '../../shared/constants';
import { ApiError } from '../errors/api.error';
import { getExtensionFromMimeType, validateFileMagicBytes } from '../utils/file-validator.util';

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter function (MIME type check)
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
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

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.MAX_FILE_SIZE,
    files: 5, // Maximum 5 files per request
  },
});

// Middleware for single file upload
export const uploadSingle = (fieldName: string = 'file') => {
  return upload.single(fieldName);
};

// Middleware for multiple file upload
export const uploadMultiple = (fieldName: string = 'files', maxCount: number = 5) => {
  return upload.array(fieldName, maxCount);
};

// Middleware for mixed file uploads
export const uploadFields = (fields: multer.Field[]) => {
  return upload.fields(fields);
};

/**
 * Middleware to validate file content after multer upload
 * This verifies magic bytes match declared MIME type
 */
export const validateFileContent = (req: Request, res: Response, next: NextFunction) => {
  const file = req.file;

  if (!file) {
    return next(); // No file to validate
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

  // Attach extension to file object for later use
  (file as any).extension = getExtensionFromMimeType(file.mimetype);

  next();
};

export default upload;
