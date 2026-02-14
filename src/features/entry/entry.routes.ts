import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { EntryController } from './entry.controller';
import { createEntryValidation, entryIdValidation, searchEntriesValidation, updateEntryValidation } from './entry.validations';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';

const router = Router();

// All routes require authentication
router.use(AuthMiddleware.authenticate);

// Entry routes
router.post('/', createEntryValidation, ValidationMiddleware.validate, EntryController.createEntry);
router.get('/search', searchEntriesValidation, ValidationMiddleware.validate, EntryController.searchEntries);
router.get('/stats', EntryController.getEntryStats);
router.get('/feed', EntryController.getFeed);
router.get('/', EntryController.getUserEntries);
router.get('/:id', entryIdValidation, ValidationMiddleware.validate, EntryController.getEntryById);
router.patch('/:id/favorite', entryIdValidation, ValidationMiddleware.validate, EntryController.toggleFavorite);
router.put('/:id', entryIdValidation, updateEntryValidation, ValidationMiddleware.validate, EntryController.updateEntry);
router.delete('/:id', entryIdValidation, ValidationMiddleware.validate, EntryController.deleteEntry);

export default router;
