import { Router } from 'express';
import { DocumentController } from './document.controller';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.post('/', DocumentController.createDocument);
router.get('/', DocumentController.getDocuments);
router.get('/recent', DocumentController.getRecentDocuments);
router.get('/:id', DocumentController.getDocumentById);
router.put('/:id', DocumentController.updateDocument);
router.delete('/:id', DocumentController.deleteDocument);

export default router;
