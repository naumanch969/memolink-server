import { Response } from 'express';
import { ApiError } from '../../core/errors/api.error';
import { ResponseHelper } from '../../core/utils/response.utils';
import { AuthenticatedRequest } from '../auth/auth.types';
import { ListService } from './list.service';

const listService = new ListService();

export class ListController {
    static async createList(req: AuthenticatedRequest, res: Response) {
        try {
            if (!req.user) throw ApiError.unauthorized('Not authenticated');

            const list = await listService.createList(req.user._id.toString(), req.body);

            ResponseHelper.created(res, list);
        } catch (error) {
            ResponseHelper.error(res, 'Failed to create list', 500, error);
        }
    }

    static async getLists(req: AuthenticatedRequest, res: Response) {
        try {
            if (!req.user) throw ApiError.unauthorized('Not authenticated');

            const lists = await listService.getLists(req.user._id.toString());

            ResponseHelper.success(res, lists);
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve lists', 500, error);
        }
    }

    static async updateList(req: AuthenticatedRequest, res: Response) {
        try {
            if (!req.user) throw ApiError.unauthorized('Not authenticated');

            const list = await listService.updateList(req.user._id.toString(), req.params.id, req.body);

            ResponseHelper.success(res, list);
        } catch (error) {
            ResponseHelper.error(res, 'Failed to update list', 500, error);
        }
    }

    static async deleteList(req: AuthenticatedRequest, res: Response) {
        try {
            if (!req.user) throw ApiError.unauthorized('Not authenticated');

            await listService.deleteList(req.user._id.toString(), req.params.id);

            ResponseHelper.success(res, null, 'List deleted');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to delete list', 500, error);
        }
    }

    static async reorderLists(req: AuthenticatedRequest, res: Response) {
        try {
            if (!req.user) throw ApiError.unauthorized('Not authenticated');

            const { listIds } = req.body;
            if (!Array.isArray(listIds)) {
                throw ApiError.badRequest('listIds must be an array of strings');
            }

            await listService.reorderLists(req.user._id.toString(), listIds);

            ResponseHelper.success(res, null, 'Lists reordered successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to reorder lists', 500, error);
        }
    }
}
