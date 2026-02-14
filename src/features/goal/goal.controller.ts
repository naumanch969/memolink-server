import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.util';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { CreateGoalParams, GetGoalsQuery, UpdateGoalParams, UpdateGoalProgressParams, } from './goal.interfaces';
import { goalService } from './goal.service';

export class GoalController {

    static async create(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const params: CreateGoalParams = req.body;

            const goal = await goalService.createGoal(userId, params);

            ResponseHelper.created(res, goal, 'Goal created successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to create goal', 500, error);
        }
    }

    static async list(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const query = req.query as unknown as GetGoalsQuery;

            const goals = await goalService.getGoals(userId, query);

            ResponseHelper.success(res, goals, 'Goals retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve goals', 500, error);
        }
    }

    static async getOne(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;

            const goal = await goalService.getGoalById(userId, id);

            if (!goal) {
                ResponseHelper.notFound(res, 'Goal not found');
                return;
            }

            ResponseHelper.success(res, goal, 'Goal retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve goal', 500, error);
        }
    }

    static async update(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            const params: UpdateGoalParams = req.body;

            const goal = await goalService.updateGoal(userId, id, params);

            if (!goal) {
                ResponseHelper.notFound(res, 'Goal not found');
                return;
            }

            ResponseHelper.success(res, goal, 'Goal updated successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to update goal', 500, error);
        }
    }

    static async updateProgress(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            const params: UpdateGoalProgressParams = req.body;

            const goal = await goalService.updateProgress(userId, id, params);

            if (!goal) {
                ResponseHelper.notFound(res, 'Goal not found');
                return;
            }

            ResponseHelper.success(res, goal, 'Goal progress updated successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to update goal progress', 500, error);
        }
    }

    static async delete(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;

            const success = await goalService.deleteGoal(userId, id);

            if (!success) {
                ResponseHelper.notFound(res, 'Goal not found or could not be deleted');
                return;
            }

            ResponseHelper.success(res, null, 'Goal deleted successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to delete goal', 500, error);
        }
    }
}
