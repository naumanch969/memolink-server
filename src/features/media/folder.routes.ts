import { Router } from 'express';
import { body, param } from 'express-validator';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { FolderController } from './folder.controller';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';

const router = Router();

// All routes require authentication
router.use(AuthMiddleware.authenticate);

// Create folder
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Folder name is required'),
    body('description').optional().trim(),
    body('color').optional().isString(),
    body('icon').optional().isString(),
    body('parentId').optional().isMongoId().withMessage('Invalid parent folder ID'),
  ],
  ValidationMiddleware.validate,
  FolderController.createFolder
);

// Get all folders
router.get('/', FolderController.getFolders);

// Get folder by ID
router.get('/:id', [param('id').isMongoId()], ValidationMiddleware.validate, FolderController.getFolderById);

// Update folder
router.put(
  '/:id',
  [
    param('id').isMongoId(),
    body('name').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('color').optional().isString(),
    body('icon').optional().isString(),
    body('parentId').optional().isMongoId(),
  ],
  ValidationMiddleware.validate,
  FolderController.updateFolder
);

// Delete folder
router.delete('/:id', [param('id').isMongoId()], ValidationMiddleware.validate, FolderController.deleteFolder);

// Move folder items to another folder
router.post(
  '/:id/move',
  [
    param('id').isMongoId(),
    body('targetFolderId').optional().isMongoId().withMessage('Invalid target folder ID'),
  ],
  ValidationMiddleware.validate,
  FolderController.moveFolderItems
);

export default router;
