import { Router } from 'express';
import { createCategory, getCategories, getCategoryById, updateCategory, deleteCategory, getSubcategories, searchCategories, } from './category.controller';
import { auth, optionalAuth } from '../../middlewares/auth';
import { validateCategory, handleValidationErrors } from '../../middlewares/validation';

const router = Router();

// Public routes (with optional auth)
router.get('/', optionalAuth, getCategories);
router.get('/search', optionalAuth, searchCategories);
router.get('/category/:_id', optionalAuth, getCategoryById);
router.get('/category/:parentId/subcategories', optionalAuth, getSubcategories);

// Protected routes (require auth)
router.post('/', auth, validateCategory, handleValidationErrors, createCategory);
router.put('/category/:_id', auth, validateCategory, handleValidationErrors, updateCategory);
router.delete('/category/:_id', auth, deleteCategory);

export default router;
