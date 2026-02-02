import { Router } from 'express';
import { authenticate } from '../../core/middleware/authMiddleware';
import { DocumentController } from './document.controller';

const router = Router();

router.use(authenticate);

router.post('/', DocumentController.createDocument);
router.get('/', DocumentController.getDocuments);
router.get('/recent', DocumentController.getRecentDocuments);
router.get('/:id', DocumentController.getDocumentById);
router.put('/:id', DocumentController.updateDocument);
router.delete('/:id', DocumentController.deleteDocument);

export default router;
