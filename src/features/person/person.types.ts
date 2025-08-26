import { Request } from 'express';

// Request types
export interface CreatePersonRequest {
  name: string;
  avatar?: string;
  email?: string;
  phone?: string;
  relationship?: string;
  tags?: string[];
  notes?: string;
  birthday?: string | Date; // Accept both string and Date
  lastContact?: string | Date; // Accept both string and Date
  contactFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'rarely';
}

export interface GetPersonByIdRequest {
  _id: string;
}

export interface UpdatePersonRequest {
  _id: string;
  name?: string;
  avatar?: string;
  email?: string;
  phone?: string;
  relationship?: string;
  tags?: string[];
  notes?: string;
  birthday?: string | Date; // Accept both string and Date
  lastContact?: string | Date; // Accept both string and Date
  contactFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'rarely';
  isActive?: boolean;
}

export interface DeletePersonRequest {
  _id: string;
}

export interface SearchPeopleRequest {
  query: string;
  relationship?: string;
  tags?: string[];
}

// Response types
export interface PersonResponse {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
  phone?: string;
  relationship?: string;
  isActive: boolean;
  tags?: string[];
  notes?: string;
  birthday?: Date;
  lastContact?: Date;
  contactFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'rarely';
  createdAt?: Date;
  updatedAt?: Date;
}

// Extended request with user
export interface PersonRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

// Validation schemas
export const createPersonSchema = {
  name: {
    in: ['body'],
    isLength: {
      options: { min: 1, max: 100 },
      errorMessage: 'Name must be between 1 and 100 characters',
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
  email: {
    in: ['body'],
    optional: true,
    isEmail: {
      errorMessage: 'Must be a valid email address',
    },
    normalizeEmail: true,
    trim: true,
  },
  phone: {
    in: ['body'],
    optional: true,
    isLength: {
      options: { max: 20 },
      errorMessage: 'Phone must be less than 20 characters',
    },
    trim: true,
  },
  relationship: {
    in: ['body'],
    optional: true,
    isLength: {
      options: { max: 100 },
      errorMessage: 'Relationship must be less than 100 characters',
    },
    trim: true,
  },
  tags: {
    in: ['body'],
    optional: true,
    isArray: {
      errorMessage: 'Tags must be an array',
    },
  },
  'tags.*': {
    optional: true,
    isLength: {
      options: { max: 50 },
      errorMessage: 'Each tag must be less than 50 characters',
    },
    trim: true,
  },
  notes: {
    in: ['body'],
    optional: true,
    isLength: {
      options: { max: 1000 },
      errorMessage: 'Notes must be less than 1000 characters',
    },
    trim: true,
  },
  birthday: {
    in: ['body'],
    optional: true,
    isISO8601: {
      errorMessage: 'Birthday must be a valid ISO date',
    },
  },
  lastContact: {
    in: ['body'],
    optional: true,
    isISO8601: {
      errorMessage: 'Last contact must be a valid ISO date',
    },
  },
  contactFrequency: {
    in: ['body'],
    optional: true,
    isIn: {
      options: [['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'rarely']],
      errorMessage: 'Contact frequency must be one of: daily, weekly, monthly, quarterly, yearly, rarely',
    },
  },
};

export const updatePersonSchema = {
  ...createPersonSchema,
  isActive: {
    in: ['body'],
    optional: true,
    isBoolean: {
      errorMessage: 'Is active must be a boolean',
    },
  },
};

export const searchPeopleSchema = {
  query: {
    in: ['query'],
    isLength: {
      options: { min: 1, max: 100 },
      errorMessage: 'Search query must be between 1 and 100 characters',
    },
    trim: true,
  },
  relationship: {
    in: ['query'],
    optional: true,
    isLength: {
      options: { max: 100 },
      errorMessage: 'Relationship filter must be less than 100 characters',
    },
    trim: true,
  },
  tags: {
    in: ['query'],
    optional: true,
    isArray: {
      errorMessage: 'Tags filter must be an array',
    },
  },
  'tags.*': {
    optional: true,
    isLength: {
      options: { max: 50 },
      errorMessage: 'Each tag filter must be less than 50 characters',
    },
    trim: true,
  },
};
