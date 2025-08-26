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
  async registerUser(email: string, password: string, name?: string): Promise<ApiResponse<{ token: string; user: { _id: string; email: string; name?: string } }>> {
    try {
      // Check if user already exists
      const existingUser = inMemoryUsers.find(u => u.email === email);
      if (existingUser) {
        return {
          success: false,
          error: 'User with this email already exists',
        };
      }

      // Create new user
      const newUser = {
        _id: userIdCounter.toString(),
        email,
        password: await bcrypt.hash(password, 10),
        name,
        avatar: undefined,
        preferences: {
          theme: 'auto',
          language: 'en',
          timezone: 'UTC',
          notifications: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      inMemoryUsers.push(newUser);
      userIdCounter++;

      // Generate token
      const token = this.generateToken(newUser._id, newUser.email);

      return {
        success: true,
        data: {
          token,
          user: {
            _id: newUser._id,
            email: newUser.email,
            name: newUser.name,
          },
        },
        message: 'User registered successfully',
      };
    } catch (error) {
      console.error('Register user error:', error);
      return {
        success: false,
        error: 'Failed to register user',
      };
    }
  }

  /**
   * Login user
   */
  async loginUser(email: string, password: string): Promise<ApiResponse<{ token: string; user: { _id: string; email: string; name?: string } }>> {
    try {
      // Find user by email
      const user = inMemoryUsers.find(u => u.email === email);
      if (!user) {
        return {
          success: false,
          error: 'Invalid email or password',
        };
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return {
          success: false,
          error: 'Invalid email or password',
        };
      }

      // Generate token
      const token = this.generateToken(user._id, user.email);

      return {
        success: true,
        data: {
          token,
          user: {
            _id: user._id,
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
  async getUserProfile(userId: string): Promise<ApiResponse<{ _id: string; email: string; name?: string; avatar?: string; preferences: any; stats: any }>> {
    try {
      const user = inMemoryUsers.find(u => u._id === userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Calculate stats (for demo purposes)
      const stats = {
        totalEntries: Math.floor(Math.random() * 100),
        totalPeople: Math.floor(Math.random() * 50),
        totalCategories: Math.floor(Math.random() * 20),
        lastActive: new Date(),
        streakDays: Math.floor(Math.random() * 30),
      };

      return {
        success: true,
        data: {
          _id: user._id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          preferences: user.preferences,
          stats,
        },
      };
    } catch (error) {
      console.error('Get user profile error:', error);
      return {
        success: false,
        error: 'Failed to fetch user profile',
      };
    }
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): { _id: string; email: string } | null {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as any;
      return {
        _id: decoded._id,
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
      { _id: userId, email },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN }
    );
  }
}

export default new AuthService();
