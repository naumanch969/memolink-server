import { IPerson } from '../../shared/types';

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
