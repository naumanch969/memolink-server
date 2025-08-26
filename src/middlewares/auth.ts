import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../interfaces';

export const auth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  // Temporarily commented out for testing
  // try {
  //   const token = req.header('Authorization')?.replace('Bearer ', '');

  //   if (!token) {
  //     res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
  //     return;
  //   }

  //   const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
  //   req.user = decoded;
  //   next();
  // } catch (error) {
  //   res.status(400).json({ success: false, error: 'Invalid token.' });
  // }
  
  // For testing, just pass through
  next();
};

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  // Temporarily commented out for testing
  // try {
  //   const token = req.header('Authorization')?.replace('Bearer ', '');

  //   if (token) {
  //     const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
  //     req.user = decoded;
  //   }
    
  //   next();
  // } catch (error) {
  //   // Continue without authentication
  //   next();
  // }
  
  // For testing, just pass through
  next();
};
