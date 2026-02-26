import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { CollectionController } from './collection.controller';
import { collectionIdValidation, createCollectionValidation, updateCollectionValidation } from './collection.validations';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.get('/', CollectionController.getUserCollections);
router.post('/', createCollectionValidation, ValidationMiddleware.validate, CollectionController.createCollection);
router.get('/:id', collectionIdValidation, ValidationMiddleware.validate, CollectionController.getCollectionById);
router.put('/:id', collectionIdValidation, updateCollectionValidation, ValidationMiddleware.validate, CollectionController.updateCollection);
router.delete('/:id', collectionIdValidation, ValidationMiddleware.validate, CollectionController.deleteCollection);

export default router;
