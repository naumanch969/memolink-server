import { Router } from 'express';
import { createCategory, getCategories, getCategoryById, updateCategory, deleteCategory, getSubcategories, searchCategories, } from './category.controller';
import { auth, optionalAuth } from '../../middlewares/auth';
import { validateCategory, handleValidationErrors } from '../../middlewares/validation';

const router = Router();

// Public routes (with optional auth)
router.get('/', optionalAuth, getCategories);
router.get('/search', optionalAuth, searchCategories);
router.get('/category/:id', optionalAuth, getCategoryById);
router.get('/category/:parentId/subcategories', optionalAuth, getSubcategories);

// Protected routes (require auth)
router.post('/', auth, validateCategory, handleValidationErrors, createCategory);
router.put('/category/:id', auth, validateCategory, handleValidationErrors, updateCategory);
router.delete('/category/:id', auth, deleteCategory);

export default router;
