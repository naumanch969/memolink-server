import { Router } from 'express';
import { MediaController } from './media.controller';
import { authenticate } from '../../core/middleware/authMiddleware';
import { 
  createMediaValidation,
  mediaIdValidation
} from './media.validations';
import { validationMiddleware } from '../../core/middleware/validationMiddleware';
import { uploadSingle, validateFileContent } from '../../core/middleware/uploadMiddleware';

const router = Router();

router.use(authenticate);

// Upload with magic byte validation
router.post('/upload', uploadSingle('file'), validateFileContent, MediaController.uploadMedia);
router.post('/', createMediaValidation, validationMiddleware, MediaController.createMedia);
router.post('/bulk-move', MediaController.bulkMoveMedia);
router.post('/bulk-delete', MediaController.bulkDeleteMedia);
router.get('/', MediaController.getUserMedia);
router.get('/:id', mediaIdValidation, validationMiddleware, MediaController.getMediaById);
router.delete('/:id', mediaIdValidation, validationMiddleware, MediaController.deleteMedia);

export default router;
