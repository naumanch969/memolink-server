import express from 'express';
import { authenticate } from '../../core/middleware/authMiddleware';
import * as documentController from './document.controller';

const router = express.Router();

router.use(authenticate);

router.post('/', documentController.createDocument);
router.get('/', documentController.getDocuments);
router.get('/recent', documentController.getRecentDocuments);
router.get('/:id', documentController.getDocumentById);
router.put('/:id', documentController.updateDocument);
router.delete('/:id', documentController.deleteDocument);

export default router;
