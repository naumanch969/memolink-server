import { body, param } from 'express-validator';

export const createDocumentValidation = [
    body('title').optional().isString().trim(),
    body('icon').optional().isString().trim(),
    body('coverImage').optional().isURL().withMessage('Invalid cover image URL'),
    body('parentId').optional({ nullable: true }).isMongoId().withMessage('Invalid parent ID'),
];

export const updateDocumentValidation = [
    param('id').isMongoId().withMessage('Invalid document ID'),
    body('title').optional().isString().trim(),
    body('isFavorite').optional().isBoolean(),
    body('isArchived').optional().isBoolean(),
    body('parentId').optional({ nullable: true }).isMongoId(),
];

export const documentIdValidation = [
    param('id').isMongoId().withMessage('Invalid document ID'),
];
