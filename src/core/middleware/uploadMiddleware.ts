import multer from 'multer';
import { Request } from 'express';
import { config } from '../../config/env';
import { FILE_UPLOAD } from '../../shared/constants';
import { createError } from './errorHandler';

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    ...FILE_UPLOAD.ALLOWED_IMAGE_TYPES,
    ...FILE_UPLOAD.ALLOWED_VIDEO_TYPES,
    ...FILE_UPLOAD.ALLOWED_DOCUMENT_TYPES,
  ];

  if (allowedTypes.includes(file.mimetype as any)) {
    cb(null, true);
  } else {
    cb(createError(`File type ${file.mimetype} is not allowed`, 400));
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

export default upload;
