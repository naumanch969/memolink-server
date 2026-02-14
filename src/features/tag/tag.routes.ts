import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { TagController } from './tag.controller';
import { createTagValidation, tagIdValidation, updateTagValidation } from './tag.validations';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.get('/search', TagController.searchTags);
router.post('/', createTagValidation, ValidationMiddleware.validate, TagController.createTag);
router.get('/', TagController.getUserTags);
router.get('/:id', tagIdValidation, ValidationMiddleware.validate, TagController.getTagById);
router.put('/:id', tagIdValidation, updateTagValidation, ValidationMiddleware.validate, TagController.updateTag);
router.delete('/:id', tagIdValidation, ValidationMiddleware.validate, TagController.deleteTag);

router.get('/stats', TagController.getTagStats);
export default router;
