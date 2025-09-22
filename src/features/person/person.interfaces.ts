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
  notes?: string;
}

export interface UpdatePersonRequest {
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  notes?: string;
}
