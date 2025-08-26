import { Request } from 'express';

// Request types
export interface CreateUserRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  name?: string;
  avatar?: string;
  preferences?: {
    theme?: 'light' | 'dark' | 'auto';
    language?: string;
    timezone?: string;
    notifications?: boolean;
  };
}

export interface User {
  _id: string;
  email: string;
  password: string;
  name?: string;
  avatar?: string;
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
    notifications: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  success: boolean;
  data?: {
    token: string;
    user: {
      _id: string;
      email: string;
      name?: string;
    };
  };
  message?: string;
  error?: string;
}

export interface ProfileResponse {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
    notifications: boolean;
    emailNotifications: boolean;
    pushNotifications: boolean;
    privacyLevel: 'public' | 'friends' | 'private';
  };
  stats: {
    totalEntries: number;
    totalPeople: number;
    totalCategories: number;
    lastActive: Date;
    streakDays: number;
  };
}

// Extended request with user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

// Validation schemas
export const registerSchema = {
  email: {
    in: ['body'],
    isEmail: {
      errorMessage: 'Must be a valid email address',
    },
    normalizeEmail: true,
    trim: true,
  },
  password: {
    in: ['body'],
    isLength: {
      options: { min: 6, max: 100 },
      errorMessage: 'Password must be between 6 and 100 characters',
    },
    trim: true,
  },
  name: {
    in: ['body'],
    optional: true,
    isLength: {
      options: { max: 100 },
      errorMessage: 'Name must be less than 100 characters',
    },
    trim: true,
  },
};

export const loginSchema = {
  email: {
    in: ['body'],
    isEmail: {
      errorMessage: 'Must be a valid email address',
    },
    normalizeEmail: true,
    trim: true,
  },
  password: {
    in: ['body'],
    isLength: {
      options: { min: 1 },
      errorMessage: 'Password is required',
    },
    trim: true,
  },
};

export const profileUpdateSchema = {
  name: {
    in: ['body'],
    optional: true,
    isLength: {
      options: { max: 100 },
      errorMessage: 'Name must be less than 100 characters',
    },
    trim: true,
  },
  avatar: {
    in: ['body'],
    optional: true,
    isURL: {
      errorMessage: 'Avatar must be a valid URL',
    },
    trim: true,
  },
  'preferences.theme': {
    in: ['body'],
    optional: true,
    isIn: {
      options: [['light', 'dark', 'auto']],
      errorMessage: 'Theme must be light, dark, or auto',
    },
  },
  'preferences.language': {
    in: ['body'],
    optional: true,
    isLength: {
      options: { max: 10 },
      errorMessage: 'Language must be less than 10 characters',
    },
    trim: true,
  },
  'preferences.timezone': {
    in: ['body'],
    optional: true,
    isLength: {
      options: { max: 50 },
      errorMessage: 'Timezone must be less than 50 characters',
    },
    trim: true,
  },
  'preferences.notifications': {
    in: ['body'],
    optional: true,
    isBoolean: {
      errorMessage: 'Notifications must be a boolean',
    },
  },
  'preferences.emailNotifications': {
    in: ['body'],
    optional: true,
    isBoolean: {
      errorMessage: 'Email notifications must be a boolean',
    },
  },
  'preferences.pushNotifications': {
    in: ['body'],
    optional: true,
    isBoolean: {
      errorMessage: 'Push notifications must be a boolean',
    },
  },
  'preferences.privacyLevel': {
    in: ['body'],
    optional: true,
    isIn: {
      options: [['public', 'friends', 'private']],
      errorMessage: 'Privacy level must be public, friends, or private',
    },
  },
};

