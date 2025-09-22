import { body, param } from 'express-validator';

export const createMediaValidation = [
  body('filename')
    .notEmpty()
    .withMessage('Filename is required'),
  
  body('originalName')
    .notEmpty()
    .withMessage('Original name is required'),
  
  body('mimeType')
    .notEmpty()
    .withMessage('MIME type is required'),
  
  body('size')
    .isInt({ min: 1 })
    .withMessage('Size must be a positive integer'),
  
  body('url')
    .isURL()
    .withMessage('URL must be valid'),
  
  body('cloudinaryId')
    .notEmpty()
    .withMessage('Cloudinary ID is required'),
  
  body('type')
    .isIn(['image', 'video', 'document', 'audio'])
    .withMessage('Type must be image, video, document, or audio'),
];

export const mediaIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid media ID format'),
];
