import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { ListController } from './list.controller';
import { createListValidation, reorderListsValidation, updateListValidation, listIdValidation } from './list.validations';

const router = Router();

// Protect all routes
router.use(AuthMiddleware.authenticate);

router.get('/', ListController.getLists);
router.post('/', createListValidation, ValidationMiddleware.validate, ListController.createList);
router.post('/reorder', reorderListsValidation, ValidationMiddleware.validate, ListController.reorderLists);
router.patch('/:id', updateListValidation, ValidationMiddleware.validate, ListController.updateList);
router.delete('/:id', listIdValidation, ValidationMiddleware.validate, ListController.deleteList);

export default router;
