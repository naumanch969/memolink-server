import { Router } from 'express';
import { ChunkedUploadController } from './chunked-upload.controller';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(AuthMiddleware.authenticate);

// Initialize a new upload session
router.post('/init', ChunkedUploadController.initSession);

// Get user's active sessions
router.get('/', ChunkedUploadController.getUserSessions);

// Upload a chunk (use raw body parser)
router.put('/:sessionId/chunk', ChunkedUploadController.uploadChunk);

// Get session status
router.get('/:sessionId', ChunkedUploadController.getSessionStatus);

// Complete upload
router.post('/:sessionId/complete', ChunkedUploadController.completeUpload);

// Cancel session
router.delete('/:sessionId', ChunkedUploadController.cancelSession);

export default router;
