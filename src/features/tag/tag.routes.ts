import { Router } from 'express';
import { validationMiddleware } from '../../core/middleware/validation.middleware';
import { TagController } from './tag.controller';
import { createTagValidation, tagIdValidation, updateTagValidation } from './tag.validations';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.get('/search', TagController.searchTags);
router.post('/', createTagValidation, validationMiddleware, TagController.createTag);
router.get('/', TagController.getUserTags);
router.get('/:id', tagIdValidation, validationMiddleware, TagController.getTagById);
router.put('/:id', tagIdValidation, updateTagValidation, validationMiddleware, TagController.updateTag);
router.delete('/:id', tagIdValidation, validationMiddleware, TagController.deleteTag);

router.get('/stats', TagController.getTagStats);
export default router;
