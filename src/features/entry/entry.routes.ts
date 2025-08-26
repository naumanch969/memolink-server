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
router.get('/entry/:_id', optionalAuth, getEntryById);

// Protected routes (require auth)
router.post('/', auth, validateEntry, handleValidationErrors, createEntry);
router.put('/entry/:_id', auth, validateEntry, handleValidationErrors, updateEntry);
router.delete('/entry/:_id', auth, deleteEntry);
router.post('/entry/:_id/reactions', auth, toggleReaction);

export default router;
