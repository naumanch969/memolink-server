import { Router } from 'express';
import { MediaController } from './media.controller';
import { authenticate } from '../../core/middleware/authMiddleware';
import { 
  createMediaValidation,
  mediaIdValidation
} from './media.validations';
import { validationMiddleware } from '../../core/middleware/validationMiddleware';
import { uploadSingle } from '../../core/middleware/uploadMiddleware';

const router = Router();

router.use(authenticate);

router.post('/upload', uploadSingle('file'), MediaController.uploadMedia);
router.post('/', createMediaValidation, validationMiddleware, MediaController.createMedia);
router.get('/', MediaController.getUserMedia);
router.get('/:id', mediaIdValidation, validationMiddleware, MediaController.getMediaById);
router.delete('/:id', mediaIdValidation, validationMiddleware, MediaController.deleteMedia);

export default router;
