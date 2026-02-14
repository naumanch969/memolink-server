import { Router } from 'express';
import { validationMiddleware } from '../../core/middleware/validation.middleware';
import { EntryController } from './entry.controller';
import { createEntryValidation, entryIdValidation, searchEntriesValidation, updateEntryValidation } from './entry.validations';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(AuthMiddleware.authenticate);

// Entry routes
router.post('/', createEntryValidation, validationMiddleware, EntryController.createEntry);
router.get('/search', searchEntriesValidation, validationMiddleware, EntryController.searchEntries);
router.get('/stats', EntryController.getEntryStats);
router.get('/feed', EntryController.getFeed);
router.get('/', EntryController.getUserEntries);
router.get('/:id', entryIdValidation, validationMiddleware, EntryController.getEntryById);
router.patch('/:id/favorite', entryIdValidation, validationMiddleware, EntryController.toggleFavorite);
router.put('/:id', entryIdValidation, updateEntryValidation, validationMiddleware, EntryController.updateEntry);
router.delete('/:id', entryIdValidation, validationMiddleware, EntryController.deleteEntry);

export default router;
