import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { usersAdminService } from './users.admin.service';

export class UsersAdminController {

    static async getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const search = req.query.search as string;
            const role = req.query.role as string;

            const result = await usersAdminService.getUsers({ page, limit, search, role });
            ResponseHelper.paginated(res, result.users, {
                page: result.page,
                limit,
                total: result.total,
                totalPages: result.totalPages
            }, 'Users retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }


    static async getUserDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const user = await usersAdminService.getUserDetails(id);
            ResponseHelper.success(res, user, 'User details retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const updates = req.body;
            const user = await usersAdminService.updateUser(id, updates);
            ResponseHelper.success(res, user, 'User updated successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const result = await usersAdminService.deleteUser(id);
            ResponseHelper.success(res, result, 'User and all associated data deleted successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async deactivateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const user = await usersAdminService.deactivateUser(id);
            ResponseHelper.success(res, user, 'User account deactivated successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }

    static async reactivateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const user = await usersAdminService.reactivateUser(id);
            ResponseHelper.success(res, user, 'User account reactivated successfully');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Internal server error', 500, error);
        }
    }
}
