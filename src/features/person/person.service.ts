import { Person } from './person.model';
import { logger } from '../../config/logger';
import { createNotFoundError } from '../../core/middleware/errorHandler';
import { CreatePersonRequest, UpdatePersonRequest, IPersonService } from './person.interfaces';
import { IPerson } from '../../shared/types';
import { Helpers } from '../../shared/helpers';
import { Types } from 'mongoose';

export class PersonService implements IPersonService {
  async createPerson(userId: string, personData: CreatePersonRequest): Promise<IPerson> {
    try {
      const person = new Person({
        userId: new Types.ObjectId(userId),
        ...personData,
      });

      await person.save();
      logger.info('Person created successfully', { personId: person._id, userId });
      return person;
    } catch (error) {
      logger.error('Person creation failed:', error);
      throw error;
    }
  }

  async getPersonById(personId: string, userId: string): Promise<IPerson> {
    try {
      const person = await Person.findOne({ _id: personId, userId });
      if (!person) {
        throw createNotFoundError('Person');
      }
      return person;
    } catch (error) {
      logger.error('Get person by ID failed:', error);
      throw error;
    }
  }

  async getUserPersons(userId: string, options: any = {}): Promise<{
    persons: IPerson[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const { page, limit, skip } = Helpers.getPaginationParams(options);
      const sort = Helpers.getSortParams(options, 'interactionCount');

      const [persons, total] = await Promise.all([
        Person.find({ userId }).sort(sort as any).skip(skip).limit(limit),
        Person.countDocuments({ userId }),
      ]);

      const totalPages = Math.ceil(total / limit);
      return { persons, total, page, limit, totalPages };
    } catch (error) {
      logger.error('Get user persons failed:', error);
      throw error;
    }
  }

  async updatePerson(personId: string, userId: string, updateData: UpdatePersonRequest): Promise<IPerson> {
    try {
      const person = await Person.findOneAndUpdate(
        { _id: personId, userId },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!person) {
        throw createNotFoundError('Person');
      }

      logger.info('Person updated successfully', { personId: person._id, userId });
      return person;
    } catch (error) {
      logger.error('Person update failed:', error);
      throw error;
    }
  }

  async deletePerson(personId: string, userId: string): Promise<void> {
    try {
      const person = await Person.findOneAndDelete({ _id: personId, userId });
      if (!person) {
        throw createNotFoundError('Person');
      }
      logger.info('Person deleted successfully', { personId: person._id, userId });
    } catch (error) {
      logger.error('Person deletion failed:', error);
      throw error;
    }
  }
}

export const personService = new PersonService();

export default PersonService;
