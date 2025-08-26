import { Router } from 'express';
import {
  createEntry,
  getEntries,
  getEntryById,
  updateEntry,
  deleteEntry,
  searchEntries,
  getEntriesByPerson,
  toggleReaction,
  getEntryStats,
} from './entry.controller';
import { auth, optionalAuth } from '../../middlewares/auth';
import { validateEntry, handleValidationErrors } from '../../middlewares/validation';

const router = Router();

// Public routes (with optional auth)
router.get('/', optionalAuth, getEntries);
router.get('/stats', getEntryStats);
router.post('/search', optionalAuth, searchEntries);
router.get('/person/:personId', optionalAuth, getEntriesByPerson);
router.get('/entry/:id', optionalAuth, getEntryById);

// Protected routes (require auth)
router.post('/', auth, validateEntry, handleValidationErrors, createEntry);
router.put('/entry/:id', auth, validateEntry, handleValidationErrors, updateEntry);
router.delete('/entry/:id', auth, deleteEntry);
router.post('/entry/:id/reactions', auth, toggleReaction);

export default router;
