import { Router } from 'express';
import { TagController } from './tag.controller';
import { authenticate } from '../../core/middleware/authMiddleware';
import { 
  createTagValidation,
  updateTagValidation,
  tagIdValidation
} from './tag.validations';
import { validationMiddleware } from '../../core/middleware/validationMiddleware';

const router = Router();

router.use(authenticate);

router.post('/', createTagValidation, validationMiddleware, TagController.createTag);
router.get('/', TagController.getUserTags);
router.get('/:id', tagIdValidation, validationMiddleware, TagController.getTagById);
router.put('/:id', tagIdValidation, updateTagValidation, validationMiddleware, TagController.updateTag);
router.delete('/:id', tagIdValidation, validationMiddleware, TagController.deleteTag);

export default router;
