import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { createConflictError, createNotFoundError } from '../../core/middleware/errorHandler';
import { Helpers } from '../../shared/helpers';
import { IPerson } from '../../shared/types';
import { CreatePersonRequest, IPersonService, UpdatePersonRequest } from './person.interfaces';
import { Person } from './person.model';

export class PersonService implements IPersonService {
  async createPerson(userId: string, personData: CreatePersonRequest): Promise<IPerson> {
    try {
      // Check for duplicate name (case-insensitive) for this user
      const existingPerson = await Person.findOne({
        userId,
        name: { $regex: new RegExp(`^${personData.name.trim()}$`, 'i') },
        isDeleted: { $ne: true }
      });

      if (existingPerson) {
        // If exact match on name, verify if we should throw or just return existing?
        // Usually, implicit merge is dangerous. Better to warn.
        // However, standard flow is:
        throw createConflictError(`Person with name "${personData.name}" already exists.`);
      }

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
      const person = await Person.findOne({ _id: personId, userId, isDeleted: { $ne: true } });
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

      // Determine sort
      let sort: any = { updatedAt: -1 };
      if (options.sortBy === 'interactionCount') {
        sort = {
          interactionCount: options.sortOrder === 'asc' ? 1 : -1,
          updatedAt: -1 // Tie-breaker
        };
      } else if (options.sortBy === 'name') {
        sort = {
          name: options.sortOrder === 'desc' ? -1 : 1,
          updatedAt: -1
        };
      }

      // Filter
      const query: any = {
        userId: new Types.ObjectId(userId),
        isDeleted: { $ne: true }
      };

      if (options.search) {
        const escapedSearch = options.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(escapedSearch, 'i');
        query.$or = [
          { name: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
          { phone: { $regex: searchRegex } },
          { company: { $regex: searchRegex } },
          { jobTitle: { $regex: searchRegex } },
          { tags: { $in: [searchRegex] } } // Optimized from elemMatch for strings
        ];
      }

      const [persons, total] = await Promise.all([
        Person.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Person.countDocuments(query)
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        persons: persons as IPerson[],
        total,
        page,
        limit,
        totalPages
      };
    } catch (error) {
      logger.error('Get user persons failed:', error);
      throw error;
    }
  }

  async updatePerson(personId: string, userId: string, updateData: UpdatePersonRequest): Promise<IPerson> {
    try {
      const person = await Person.findOneAndUpdate(
        { _id: personId, userId, isDeleted: { $ne: true } },
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
      // Soft delete
      const person = await Person.findOneAndUpdate(
        { _id: personId, userId, isDeleted: { $ne: true } },
        {
          $set: {
            isDeleted: true,
            deletedAt: new Date()
          }
        },
        { new: true }
      );

      if (!person) {
        throw createNotFoundError('Person');
      }
      logger.info('Person soft-deleted successfully', { personId: person._id, userId });
    } catch (error) {
      logger.error('Person deletion failed:', error);
      throw error;
    }
  }

  async searchPersons(userId: string, query: string): Promise<IPerson[]> {
    try {
      // Escape special regex characters
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedQuery, 'i');
      const persons = await Person.find({
        userId,
        isDeleted: { $ne: true },
        $or: [
          { name: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
          { phone: { $regex: searchRegex } },
          { company: { $regex: searchRegex } },
          { jobTitle: { $regex: searchRegex } },
          { tags: { $elemMatch: { $regex: searchRegex } } }
        ]
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
        // isDeleted: false, // Should we resurrect deleted people? For now, let's create new or find active.
        name: { $regex: new RegExp(`^${name}$`, 'i') }
      });

      if (person && person.isDeleted) {
        // Option: Resurrect
        person.isDeleted = false;
        person.deletedAt = undefined;
        await person.save();
        return person;
      }

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

  async getPersonInteractions(personId: string, userId: string, options: any = {}): Promise<any> {
    try {
      const { page = 1, limit = 10 } = options;
      const skip = (page - 1) * limit;

      // Verify person exists
      await this.getPersonById(personId, userId);

      // Import Entry dynamically to avoid circular dependencies if any, or just import at top if clean.
      // Assuming Entry is in '../entry/entry.model'
      const { Entry } = await import('../entry/entry.model');

      const [entries, total] = await Promise.all([
        Entry.find({
          userId,
          mentions: personId
        })
          .sort({ date: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('mentions', 'name avatar')
          .populate('tags', 'name color'),
        Entry.countDocuments({ userId, mentions: personId })
      ]);

      return {
        entries,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Get person interactions failed:', error);
      throw error;
    }
  }
}

export const personService = new PersonService();

export default PersonService;
