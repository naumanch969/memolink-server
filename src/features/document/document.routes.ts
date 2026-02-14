import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { DocumentController } from './document.controller';
import { createDocumentValidation, documentIdValidation, updateDocumentValidation } from './document.validations';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.post('/', createDocumentValidation, ValidationMiddleware.validate, DocumentController.createDocument);
router.get('/', DocumentController.getDocuments);
router.get('/recent', DocumentController.getRecentDocuments);
router.get('/:id', documentIdValidation, ValidationMiddleware.validate, DocumentController.getDocumentById);
router.put('/:id', updateDocumentValidation, ValidationMiddleware.validate, DocumentController.updateDocument);
router.delete('/:id', documentIdValidation, ValidationMiddleware.validate, DocumentController.deleteDocument);

export default router;
