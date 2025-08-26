import { Router } from 'express';
import {
  register,
  login,
  getProfile,
  updateProfile,
} from './auth.controller';
import { auth } from '../../middlewares/auth';
import { 
  validateRegister, 
  validateLogin, 
  validateProfileUpdate 
} from './auth.validations';
import { handleValidationErrors } from '../../middlewares/validation';

const router = Router();

// Public routes
router.post('/register', validateRegister, handleValidationErrors, register);
router.post('/login', validateLogin, handleValidationErrors, login);

// Protected routes
router.get('/profile', auth, getProfile);
router.put('/profile', auth, validateProfileUpdate, handleValidationErrors, updateProfile);

export default router;
