import { Response } from 'express';
import { AuthenticatedRequest } from '../../shared/types';
import { goalService } from './goal.service';
import { HTTP_STATUS } from '../../shared/constants';
import { ResponseHelper } from '../../core/utils/response';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { CreateGoalParams, UpdateGoalParams, UpdateGoalProgressParams, GetGoalsQuery, } from './goal.interfaces';

export class GoalController {

    create = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!._id.toString();
        const params: CreateGoalParams = req.body;

        const goal = await goalService.createGoal(userId, params);

        ResponseHelper.created(res, goal, 'Goal created successfully');
    });

    list = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!._id.toString();
        const query = req.query as unknown as GetGoalsQuery;

        const goals = await goalService.getGoals(userId, query);

        ResponseHelper.success(res, goals, 'Goals retrieved successfully');
    });

    getOne = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!._id.toString();
        const { id } = req.params;

        const goal = await goalService.getGoalById(userId, id);

        if (!goal) {
            ResponseHelper.notFound(res, 'Goal not found');
            return;
        }

        ResponseHelper.success(res, goal, 'Goal retrieved successfully');
    });

    update = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!._id.toString();
        const { id } = req.params;
        const params: UpdateGoalParams = req.body;

        const goal = await goalService.updateGoal(userId, id, params);

        if (!goal) {
            ResponseHelper.notFound(res, 'Goal not found');
            return;
        }

        ResponseHelper.success(res, goal, 'Goal updated successfully');
    });

    updateProgress = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!._id.toString();
        const { id } = req.params;
        const params: UpdateGoalProgressParams = req.body;

        const goal = await goalService.updateProgress(userId, id, params);

        if (!goal) {
            ResponseHelper.notFound(res, 'Goal not found');
            return;
        }

        ResponseHelper.success(res, goal, 'Goal progress updated successfully');
    });

    delete = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!._id.toString();
        const { id } = req.params;

        const success = await goalService.deleteGoal(userId, id);

        if (!success) {
            ResponseHelper.notFound(res, 'Goal not found or could not be deleted');
            return;
        }

        ResponseHelper.success(res, null, 'Goal deleted successfully');
    });
}

export const goalController = new GoalController();
