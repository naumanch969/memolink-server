import { Response } from 'express';
import { AuthenticatedRequest } from '../../shared/types';
import { goalService } from './goal.service';
import { HTTP_STATUS } from '../../shared/constants';
import {
    CreateGoalParams,
    UpdateGoalParams,
    UpdateGoalProgressParams,
    GetGoalsQuery,
} from './goal.interfaces';

export class GoalController {

    create = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user!._id.toString();
            const params: CreateGoalParams = req.body;

            const goal = await goalService.createGoal(userId, params);

            res.status(HTTP_STATUS.CREATED).json({
                success: true,
                message: 'Goal created successfully',
                data: goal,
            });
        } catch (error: any) {
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Failed to create goal',
                error: error.message,
            });
        }
    };

    list = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user!._id.toString();
            const query = req.query as unknown as GetGoalsQuery;

            const goals = await goalService.getGoals(userId, query);

            res.status(HTTP_STATUS.OK).json({
                success: true,
                data: goals,
            });
        } catch (error: any) {
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Failed to retrieve goals',
                error: error.message,
            });
        }
    };

    getOne = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;

            const goal = await goalService.getGoalById(userId, id);

            if (!goal) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    success: false,
                    message: 'Goal not found',
                });
            }

            res.status(HTTP_STATUS.OK).json({
                success: true,
                data: goal,
            });
        } catch (error: any) {
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Failed to retrieve goal',
                error: error.message,
            });
        }
    };

    update = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            const params: UpdateGoalParams = req.body;

            const goal = await goalService.updateGoal(userId, id, params);

            if (!goal) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    success: false,
                    message: 'Goal not found',
                });
            }

            res.status(HTTP_STATUS.OK).json({
                success: true,
                message: 'Goal updated successfully',
                data: goal,
            });
        } catch (error: any) {
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Failed to update goal',
                error: error.message,
            });
        }
    };

    updateProgress = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            const params: UpdateGoalProgressParams = req.body;

            const goal = await goalService.updateProgress(userId, id, params);

            if (!goal) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    success: false,
                    message: 'Goal not found',
                });
            }

            res.status(HTTP_STATUS.OK).json({
                success: true,
                message: 'Goal progress updated successfully',
                data: goal,
            });
        } catch (error: any) {
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Failed to update goal progress',
                error: error.message,
            });
        }
    };

    delete = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;

            const success = await goalService.deleteGoal(userId, id);

            if (!success) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    success: false,
                    message: 'Goal not found or could not be deleted',
                });
            }

            res.status(HTTP_STATUS.OK).json({
                success: true,
                message: 'Goal deleted successfully',
            });
        } catch (error: any) {
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Failed to delete goal',
                error: error.message,
            });
        }
    };
}

export const goalController = new GoalController();
