import { Types } from 'mongoose';
import { BaseEntity } from '../../shared/types';

// Person Types
export interface IPerson extends BaseEntity {
  userId: Types.ObjectId;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;

  // Professional Details
  jobTitle?: string;
  company?: string;

  // Important Dates
  birthday?: Date;

  // Address
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };

  // Social & Web
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    website?: string;
    facebook?: string;
    instagram?: string;
  };

  // Organization
  tags?: string[];
  role?: string;

  notes?: string;
  isPlaceholder: boolean;
  interactionCount: number;
  lastInteractionAt?: Date;
  lastInteractionSummary?: string;
  sentimentScore?: number;

  // Soft Delete
  isDeleted: boolean;
  deletedAt?: Date;
}

// Relation Types
export interface IRelation extends BaseEntity {
  userId: Types.ObjectId;     // The user who owns this data
  sourceId: Types.ObjectId;   // Person A
  targetId: Types.ObjectId;   // Person B
  type: string;               // "Friend", "Spouse", "Colleague", etc.
  strength?: number;          // 1-10 for visualization weight
}


export interface IPersonService {
  createPerson(userId: string, personData: CreatePersonRequest): Promise<IPerson>;
  getPersonById(personId: string, userId: string): Promise<IPerson>;
  getUserPersons(userId: string, options?: any): Promise<{
    persons: IPerson[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  updatePerson(personId: string, userId: string, updateData: UpdatePersonRequest): Promise<IPerson>;
  deletePerson(personId: string, userId: string): Promise<void>;
}

export interface CreatePersonRequest {
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  jobTitle?: string;
  company?: string;
  birthday?: Date | string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    website?: string;
    facebook?: string;
    instagram?: string;
  };
  tags?: string[];
  notes?: string;
}

export interface UpdatePersonRequest {
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  jobTitle?: string;
  company?: string;
  birthday?: Date | string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    website?: string;
    facebook?: string;
    instagram?: string;
  };
  tags?: string[];
  notes?: string;
}
