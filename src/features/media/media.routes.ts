import { Router } from 'express';
import { uploadSingle, validateFileContent } from '../../core/middleware/upload.middleware';
import { validationMiddleware } from '../../core/middleware/validation.middleware';
import { MediaController } from './media.controller';
import { createMediaValidation, mediaIdValidation } from './media.validations';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

// Upload with magic byte validation
router.post('/upload', uploadSingle('file'), validateFileContent, MediaController.uploadMedia);
router.post('/', createMediaValidation, validationMiddleware, MediaController.createMedia);
router.post('/bulk-move', MediaController.bulkMoveMedia);
router.post('/bulk-delete', MediaController.bulkDeleteMedia);
router.get('/', MediaController.getUserMedia);
router.get('/:id', mediaIdValidation, validationMiddleware, MediaController.getMediaById);
router.put('/:id/thumbnail', mediaIdValidation, validationMiddleware, MediaController.updateThumbnail);
router.delete('/:id', mediaIdValidation, validationMiddleware, MediaController.deleteMedia);

export default router;
