import { Person } from './person.model';
import { Entry } from '../entry/entry.model';
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

      // Determine sort stage
      let sortStage: any = {};
      if (options.sortBy === 'interactionCount') {
        sortStage = { interactionCount: options.sortOrder === 'asc' ? 1 : -1 };
      } else if (options.sortBy === 'name') {
        sortStage = { name: options.sortOrder === 'desc' ? -1 : 1 }; // Default asc for name
      } else {
        sortStage = { updatedAt: -1 }; // Default
      }

      // Initial Filter Stage
      const matchStage: any = {
        userId: new Types.ObjectId(userId),
        isDeleted: { $ne: true }
      };

      if (options.search) {
        // Escape special regex characters
        const escapedSearch = options.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(escapedSearch, 'i');
        matchStage.$or = [
          { name: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
          { phone: { $regex: searchRegex } },
          { company: { $regex: searchRegex } },
          { jobTitle: { $regex: searchRegex } },
          { tags: { $elemMatch: { $regex: searchRegex } } }
        ];
      }

      const pipeline: any[] = [
        { $match: matchStage },
        // Lookup to count interactions dynamically
        {
          $lookup: {
            from: 'entries',
            let: { personId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $in: ['$$personId', '$mentions'] },
                      { $eq: ['$userId', new Types.ObjectId(userId)] } // Ensure entry belongs to user
                    ]
                  }
                }
              },
              { $count: 'count' }
            ],
            as: 'interactionStats'
          }
        },
        // Add interactionCount field
        {
          $addFields: {
            interactionCount: { $ifNull: [{ $arrayElemAt: ['$interactionStats.count', 0] }, 0] }
          }
        },
        // Remove the heavy stats array
        { $project: { interactionStats: 0 } },
        // Sort
        { $sort: sortStage },
        // Facet for pagination
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [{ $skip: skip }, { $limit: limit }]
          }
        }
      ];

      const result = await Person.aggregate(pipeline);

      const data = result[0].data;
      const total = result[0].metadata[0]?.total || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        persons: data as IPerson[],
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
