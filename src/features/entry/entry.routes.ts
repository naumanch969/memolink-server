import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { EntryController } from './entry.controller';
import { createEntryValidation, entryIdValidation, searchEntriesValidation, updateEntryValidation } from './entry.validation';

const router = Router();

router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.requireVault);

router.post('/', createEntryValidation, ValidationMiddleware.validate, EntryController.createEntry);
router.get('/search', searchEntriesValidation, ValidationMiddleware.validate, EntryController.searchEntries);
router.get('/stats', EntryController.getEntryStats);
router.get('/feed', EntryController.getFeed);
router.get('/', searchEntriesValidation, ValidationMiddleware.validate, EntryController.getUserEntries);
router.get('/:id', entryIdValidation, ValidationMiddleware.validate, EntryController.getEntryById);
router.patch('/:id/favorite', entryIdValidation, ValidationMiddleware.validate, EntryController.toggleFavorite);
router.patch('/:id/pin', entryIdValidation, ValidationMiddleware.validate, EntryController.togglePin);
router.put('/:id', updateEntryValidation, ValidationMiddleware.validate, EntryController.updateEntry);
router.delete('/:id', entryIdValidation, ValidationMiddleware.validate, EntryController.deleteEntry);

export default router;
