import { NextFunction, Response } from 'express';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { ResponseHelper } from '../../core/utils/response';
import { Helpers } from '../../shared/helpers';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { CreatePersonRequest, UpdatePersonRequest } from './person.interfaces';
import { personService } from './person.service';

export class PersonController {
  static createPerson = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const personData: CreatePersonRequest = req.body;
    const person = await personService.createPerson(userId, personData);

    ResponseHelper.created(res, person, 'Person created successfully');
  });

  static getPersonById = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    const person = await personService.getPersonById(id, userId);

    ResponseHelper.success(res, person, 'Person retrieved successfully');
  });

  static getUserPersons = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { page, limit, search, sortBy, sortOrder } = req.query;
    const { page: pageNum, limit: limitNum } = Helpers.getPaginationParams({ page, limit });

    const result = await personService.getUserPersons(userId, {
      page: pageNum,
      limit: limitNum,
      search: search as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as string
    });

    ResponseHelper.paginated(res, result.persons, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    }, 'Persons retrieved successfully');
  });

  static updatePerson = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    const updateData: UpdatePersonRequest = req.body;
    const person = await personService.updatePerson(id, userId, updateData);

    ResponseHelper.success(res, person, 'Person updated successfully');
  });

  static deletePerson = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    await personService.deletePerson(id, userId);

    ResponseHelper.success(res, null, 'Person deleted successfully');
  });

  static searchPersons = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      ResponseHelper.badRequest(res, 'Query parameter "q" is required');
      return;
    }

    const persons = await personService.searchPersons(userId, q);
    ResponseHelper.success(res, persons, 'Persons searched successfully');
  });

  static getPersonInteractions = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
  });

  static getGraph = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    // 1. Get all People (Nodes)
    // For now we might want all, or a limit. A graph usually shows the whole network.
    // Let's assume a reasonable limit or filter could be applied later.
    // For now, we fetch "all active" persons.
    const personsResult = await personService.getUserPersons(userId, { limit: 1000 }); // Reasonable cap for viz

    // 2. Get all Relations (Edges)
    const { relationService } = await import('./relation.service'); // Lazy import or move to top if frequently used
    const relations = await relationService.getRelations(userId);

    // 3. Format for Graph (if specific format needed, or just return raw)
    // Most/Many libraries like react-force-graph take { nodes: [], links: [] }
    // We can just return the raw data and let client map it, 
    // BUT mapped data is usually cleaner.

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
  });

  static createRelation = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { sourceId, targetId, type, strength } = req.body;

    const { relationService } = await import('./relation.service');
    const relation = await relationService.createRelation(userId, sourceId, targetId, type, strength);

    ResponseHelper.created(res, relation, 'Relation created successfully');
  });

  static deleteRelation = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;

    const { relationService } = await import('./relation.service');
    await relationService.removeRelation(userId, id);

    ResponseHelper.success(res, null, 'Relation deleted successfully');
  });
}

export default PersonController;
