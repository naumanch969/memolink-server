import { Router } from 'express';
import { FolderController } from './folder.controller';
import { authenticate } from '../../core/middleware/authMiddleware';
import { validationMiddleware } from '../../core/middleware/validationMiddleware';
import { body, param } from 'express-validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

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
  validationMiddleware,
  FolderController.createFolder
);

// Get all folders
router.get('/', FolderController.getFolders);

// Get folder by ID
router.get('/:id', [param('id').isMongoId()], validationMiddleware, FolderController.getFolderById);

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
  validationMiddleware,
  FolderController.updateFolder
);

// Delete folder
router.delete('/:id', [param('id').isMongoId()], validationMiddleware, FolderController.deleteFolder);

// Move folder items to another folder
router.post(
  '/:id/move',
  [
    param('id').isMongoId(),
    body('targetFolderId').optional().isMongoId().withMessage('Invalid target folder ID'),
  ],
  validationMiddleware,
  FolderController.moveFolderItems
);

export default router;
