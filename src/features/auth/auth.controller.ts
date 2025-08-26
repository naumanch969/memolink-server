import { Request, Response } from 'express';
import authService from './auth.service';
import { AuthRequest, RegisterRequest, LoginRequest, ProfileUpdateRequest } from './auth.types';
import { sendCreated, sendSuccess, sendBadRequest, sendUnauthorized, sendNotFound, sendInternalServerError } from '../../utils/response.utils';

export const register = async (req: Request<{}, {}, RegisterRequest>, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;
    const result = await authService.registerUser(email, password, name);
    
    if (result.success) {
      sendCreated({ res, data: result.data, message: 'User registered successfully' });
    } else {
      sendBadRequest({ res, error: result.error, message: 'Registration failed' });
    }
  } catch (error) {
    console.error('Registration error:', error);
    sendInternalServerError({ res, error: 'Failed to register user' });
  }
};

export const login = async (req: Request<{}, {}, LoginRequest>, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);
    
    if (result.success) {
      sendSuccess({ res, data: result.data, message: 'Login successful' });
    } else {
      sendUnauthorized({ res, error: result.error, message: 'Login failed' });
    }
  } catch (error) {
    console.error('Login error:', error);
    sendInternalServerError({ res, error: 'Failed to login' });
  }
};

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      sendUnauthorized({ res, error: 'Authentication required' });
      return;
    }

    const result = await authService.getUserProfile(req.user.id);
    
    if (result.success) {
      sendSuccess({ res, data: result.data, message: 'Profile retrieved successfully' });
    } else {
      sendNotFound({ res, error: result.error, message: 'Profile not found' });
    }
  } catch (error) {
    console.error('Get profile error:', error);
    sendInternalServerError({ res, error: 'Failed to get profile' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      sendUnauthorized({ res, error: 'Authentication required' });
      return;
    }

    // TODO: Implement profile update in service
    sendBadRequest({ res, error: 'Profile update not implemented yet', message: 'Feature coming soon' });
  } catch (error) {
    console.error('Update profile error:', error);
    sendInternalServerError({ res, error: 'Failed to update profile' });
  }
};
