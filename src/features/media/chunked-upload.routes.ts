/**
 * Chunked Upload Routes
 * 
 * Endpoints for resumable file uploads:
 * - POST /api/media/upload/chunked/init - Initialize session
 * - PUT /api/media/upload/chunked/:sessionId - Upload chunk
 * - GET /api/media/upload/chunked/:sessionId - Get session status
 * - POST /api/media/upload/chunked/:sessionId/complete - Complete upload
 * - DELETE /api/media/upload/chunked/:sessionId - Cancel session
 * - GET /api/media/upload/chunked - List user sessions
 */

import { Router } from 'express';
import { ChunkedUploadController } from './chunked-upload.controller';
import { authenticate } from '../../core/middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Initialize a new upload session
router.post('/init', ChunkedUploadController.initSession);

// Get user's active sessions
router.get('/', ChunkedUploadController.getUserSessions);

// Upload a chunk (use raw body parser)
router.put('/:sessionId', ChunkedUploadController.uploadChunk);

// Get session status
router.get('/:sessionId', ChunkedUploadController.getSessionStatus);

// Complete upload
router.post('/:sessionId/complete', ChunkedUploadController.completeUpload);

// Cancel session
router.delete('/:sessionId', ChunkedUploadController.cancelSession);

export default router;
