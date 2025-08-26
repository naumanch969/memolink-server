import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from './user.model';
import { User as UserInterface, ApiResponse } from '../../interfaces';

// In-memory storage for testing when database is not available
const inMemoryUsers: any[] = [];
let userIdCounter = 1;

export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;

  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
  }

  /**
   * Register a new user
   */
  async registerUser(email: string, password: string, name?: string): Promise<ApiResponse<{ token: string; user: { id: string; email: string; name?: string } }>> {
    try {
      // Check if user already exists
      const existingUser = inMemoryUsers.find(u => u.email === email);
      if (existingUser) {
        return {
          success: false,
          error: 'User with this email already exists',
        };
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create new user
      const newUser = {
        id: userIdCounter.toString(),
        email,
        password: hashedPassword,
        name,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      inMemoryUsers.push(newUser);
      userIdCounter++;

      // Generate JWT token
      const token = this.generateToken(newUser.id, newUser.email);

      return {
        success: true,
        data: {
          token,
          user: {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
          },
        },
        message: 'User registered successfully',
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: 'Failed to register user',
      };
    }
  }

  /**
   * Login user
   */
  async loginUser(email: string, password: string): Promise<ApiResponse<{ token: string; user: { id: string; email: string; name?: string } }>> {
    try {
      // Find user by email
      const user = inMemoryUsers.find(u => u.email === email);
      if (!user) {
        return {
          success: false,
          error: 'Invalid email or password',
        };
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return {
          success: false,
          error: 'Invalid email or password',
        };
      }

      // Update last login
      user.lastLogin = new Date();

      // Generate JWT token
      const token = this.generateToken(user.id, user.email);

      return {
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
        },
        message: 'Login successful',
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Failed to login',
      };
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<ApiResponse<{ id: string; email: string; name?: string; avatar?: string; preferences: any; stats: any }>> {
    try {
      const user = inMemoryUsers.find(u => u.id === userId);
      
      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      return {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          preferences: user.preferences || {
            theme: 'auto',
            language: 'en',
            timezone: 'UTC',
            notifications: true,
            emailNotifications: true,
            pushNotifications: true,
            privacyLevel: 'private',
          },
          stats: user.stats || {
            totalEntries: 0,
            totalPeople: 0,
            totalCategories: 0,
            lastActive: new Date(),
            streakDays: 0,
          },
        },
      };
    } catch (error) {
      console.error('Get profile error:', error);
      return {
        success: false,
        error: 'Failed to get profile',
      };
    }
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): { id: string; email: string } | null {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as any;
      return {
        id: decoded.id,
        email: decoded.email,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(userId: string, email: string): string {
    return jwt.sign(
      { id: userId, email },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN }
    );
  }
}

export default new AuthService();
