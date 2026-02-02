import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response';
import { Helpers } from '../../shared/helpers';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { CreatePersonRequest, UpdatePersonRequest } from './person.interfaces';
import { personService } from './person.service';

export class PersonController {
  static async createPerson(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const personData: CreatePersonRequest = req.body;
      const person = await personService.createPerson(userId, personData);

      ResponseHelper.created(res, person, 'Person created successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to create person', 500, error);
    }
  }

  static async getPersonById(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { id } = req.params;
      const person = await personService.getPersonById(id, userId);

      ResponseHelper.success(res, person, 'Person retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve person', 500, error);
    }
  }

  static async getUserPersons(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { page, limit, search, sortBy, sortOrder } = req.query;
      const { page: pageNum, limit: limitNum } = Helpers.getPaginationParams({ page, limit });

      const result = await personService.getUserPersons(userId, {
        page: pageNum,
        limit: limitNum,
        search: search as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as "asc" | "desc"
      });

      ResponseHelper.paginated(res, result.persons, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      }, 'Persons retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve persons', 500, error);
    }
  }

  static async updatePerson(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { id } = req.params;
      const updateData: UpdatePersonRequest = req.body;
      const person = await personService.updatePerson(id, userId, updateData);

      ResponseHelper.success(res, person, 'Person updated successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to update person', 500, error);
    }
  }

  static async deletePerson(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { id } = req.params;
      await personService.deletePerson(id, userId);

      ResponseHelper.success(res, null, 'Person deleted successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to delete person', 500, error);
    }
  }

  static async searchPersons(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        ResponseHelper.badRequest(res, 'Query parameter "q" is required');
        return;
      }

      const persons = await personService.searchPersons(userId, q);
      ResponseHelper.success(res, persons, 'Persons searched successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to search persons', 500, error);
    }
  }

  static async getPersonInteractions(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { id } = req.params;
      const { page, limit } = req.query;
      const { page: pageNum, limit: limitNum } = Helpers.getPaginationParams({ page, limit });

      const result = await personService.getPersonInteractions(id, userId, { page: pageNum, limit: limitNum });

      ResponseHelper.paginated(res, result.entries, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      }, 'Person interactions retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve person interactions', 500, error);
    }
  }

  static async getGraph(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      // 1. Get all People (Nodes)
      const personsResult = await personService.getUserPersons(userId, { limit: 1000 }); // Reasonable cap for viz

      // 2. Get all Relations (Edges)
      const { relationService } = await import('./relation.service'); // Lazy import or move to top if frequently used
      const relations = await relationService.getRelations(userId);

      const nodes = personsResult.persons.map(p => ({
        id: p._id.toString(),
        name: p.name,
        img: p.avatar,
        group: p.tags && p.tags.length > 0 ? p.tags[0] : 'default' // Simple grouping
      }));

      const links = relations.map(r => ({
        source: r.sourceId.toString(),
        target: r.targetId.toString(),
        type: r.type,
        strength: r.strength
      }));

      ResponseHelper.success(res, { nodes, links }, 'Graph data retrieved successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to retrieve graph data', 500, error);
    }
  }

  static async createRelation(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { sourceId, targetId, type, strength } = req.body;

      const { relationService } = await import('./relation.service');
      const relation = await relationService.createRelation(userId, sourceId, targetId, type, strength);

      ResponseHelper.created(res, relation, 'Relation created successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to create relation', 500, error);
    }
  }

  static async deleteRelation(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!._id.toString();
      const { id } = req.params;

      const { relationService } = await import('./relation.service');
      await relationService.removeRelation(userId, id);

      ResponseHelper.success(res, null, 'Relation deleted successfully');
    } catch (error) {
      ResponseHelper.error(res, 'Failed to delete relation', 500, error);
    }
  }
}

export default PersonController;
