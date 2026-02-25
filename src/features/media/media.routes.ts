import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { FileUploadMiddleware } from '../../core/middleware/upload.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { MediaController } from './media.controller';
import { createMediaValidation, mediaIdValidation } from './media.validations';

const router = Router();

router.use(AuthMiddleware.authenticate);

// Upload with magic byte validation
router.post('/upload', FileUploadMiddleware.uploadSingle('file'), FileUploadMiddleware.validateFileContent, MediaController.uploadMedia);
router.post('/', createMediaValidation, ValidationMiddleware.validate, MediaController.createMedia);
router.post('/bulk-move', MediaController.bulkMoveMedia);
router.post('/bulk-delete', MediaController.bulkDeleteMedia);
router.get('/', MediaController.getUserMedia);
router.get('/:id', mediaIdValidation, ValidationMiddleware.validate, MediaController.getMediaById);
router.put('/:id/thumbnail', mediaIdValidation, ValidationMiddleware.validate, MediaController.updateThumbnail);
router.delete('/:id', mediaIdValidation, ValidationMiddleware.validate, MediaController.deleteMedia);

export default router;
