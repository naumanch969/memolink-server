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

  async searchPersons(userId: string, query: string): Promise<IPerson[]> {
    try {
      const persons = await Person.find({
        userId,
        name: { $regex: query, $options: 'i' }
      })
      .limit(10)
      .sort({ interactionCount: -1 });

      return persons;
    } catch (error) {
      logger.error('Search persons failed:', error);
      throw error;
    }
  }

  async findOrCreatePerson(userId: string, name: string): Promise<IPerson> {
    try {
      // Try to find existing person (case-insensitive)
      let person = await Person.findOne({
        userId,
        name: { $regex: new RegExp(`^${name}$`, 'i') }
      });

      if (!person) {
        // Create new placeholder person
        person = new Person({
          userId: new Types.ObjectId(userId),
          name,
          isPlaceholder: true,
        });
        await person.save();
        logger.info('Placeholder person created', { personId: person._id, userId, name });
      }

      return person;
    } catch (error) {
      logger.error('Find or create person failed:', error);
      throw error;
    }
  }
}

export const personService = new PersonService();

export default PersonService;
