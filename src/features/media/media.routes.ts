import { Router } from 'express';
import {
  uploadMedia,
  deleteMedia,
  getMediaInfo,
  generateThumbnail,
  transformMedia,
  getAllMedia,
  getMediaByType,
} from './media.controller';
import { auth, optionalAuth } from '../../middlewares/auth';
import { upload } from '../../middlewares/upload';

const router = Router();

// Public routes (with optional auth)
router.get('/', optionalAuth, getAllMedia);
router.get('/type/:type', optionalAuth, getMediaByType);
router.get('/info/:publicId', optionalAuth, getMediaInfo);

// Protected routes (require auth)
router.post('/upload', auth, upload.single('media'), uploadMedia);
router.delete('/media/:publicId', auth, deleteMedia);
router.post('/thumbnail', auth, generateThumbnail);
router.post('/transform', auth, transformMedia);

export default router;
