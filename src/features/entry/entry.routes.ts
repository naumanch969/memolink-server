import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { EntryController } from './entry.controller';
import { createEntrySchema, entryIdSchema, searchEntriesSchema, updateEntrySchema } from './entry.schema';

const router = Router();

// All routes require authentication
router.use(AuthMiddleware.authenticate);

/**
 * Entry Routes
 */
router.post('/', ValidationMiddleware.validateSchema(createEntrySchema), EntryController.createEntry);
router.get('/search', ValidationMiddleware.validateSchema(searchEntriesSchema), EntryController.searchEntries);
router.get('/stats', EntryController.getEntryStats);
router.get('/feed', EntryController.getFeed);
router.get('/', ValidationMiddleware.validateSchema(searchEntriesSchema), EntryController.getUserEntries);
router.get('/:id', ValidationMiddleware.validateSchema(entryIdSchema), EntryController.getEntryById);
router.patch('/:id/favorite', ValidationMiddleware.validateSchema(entryIdSchema), EntryController.toggleFavorite);
router.put('/:id', ValidationMiddleware.validateSchema(updateEntrySchema), EntryController.updateEntry);
router.delete('/:id', ValidationMiddleware.validateSchema(entryIdSchema), EntryController.deleteEntry);

export default router;
