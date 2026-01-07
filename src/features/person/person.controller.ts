import { Request, Response, NextFunction } from 'express';
import { personService } from './person.service';
import { ResponseHelper } from '../../core/utils/response';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { AuthenticatedRequest } from '../../shared/types';
import { CreatePersonRequest, UpdatePersonRequest } from './person.interfaces';
import { Helpers } from '../../shared/helpers';

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
      return ResponseHelper.badRequest(res, 'Query parameter "q" is required');
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
}

export default PersonController;
