import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types';
import { Goal } from './goal.model';
import { HTTP_STATUS } from '../../shared/constants';
import { CustomError } from '../../core/middleware/errorHandler';

export class GoalController {

    static async createGoal(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user!._id;
            const { year, weekNumber, weekStartDate, weekEndDate } = req.body;

            // Helper function to calculate Monday of a given week
            function getMonday(year: number, week: number): Date {
                const jan4 = new Date(year, 0, 4);
                const dayOfWeek = jan4.getDay() || 7;
                const weekStart = new Date(jan4);
                weekStart.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
                weekStart.setHours(0, 0, 0, 0);
                return weekStart;
            }

            // Calculate dates if not provided
            let calculatedStartDate = weekStartDate;
            let calculatedEndDate = weekEndDate;

            if (!calculatedStartDate || !calculatedEndDate) {
                const monday = getMonday(year, weekNumber);
                calculatedStartDate = monday.toISOString();

                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);
                sunday.setHours(23, 59, 59, 999);
                calculatedEndDate = sunday.toISOString();
            }

            // Check if goal already exists for this week
            const existingGoal = await Goal.findOne({ userId, year, weekNumber });
            if (existingGoal) {
                throw new CustomError('Goal already exists for this week', HTTP_STATUS.BAD_REQUEST);
            }

            const goal = await Goal.create({
                userId,
                year,
                weekNumber,
                weekStartDate: calculatedStartDate,
                weekEndDate: calculatedEndDate,
                checkpoints: [],
                status: 'active',
                currentValue: 0,
                targetValue: 0
            });

            res.status(HTTP_STATUS.CREATED).json({
                success: true,
                message: 'Weekly goal created successfully',
                data: goal
            });
        } catch (error) {
            next(error);
        }
    }

    static async getGoals(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user!._id;
            const { status, year, weekNumber } = req.query;

            const query: any = { userId };
            if (status) query.status = status;
            if (year) query.year = Number(year);
            if (weekNumber) query.weekNumber = Number(weekNumber);

            // Populate checkpoints for display
            const goals = await Goal.find(query)
                .populate('checkpoints')
                .populate('linkedTags', 'name color')
                .sort({ year: 1, weekNumber: 1 });

            res.status(HTTP_STATUS.OK).json({
                success: true,
                data: goals
            });
        } catch (error) {
            next(error);
        }
    }

    static async getGoalById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const userId = req.user!._id;
            const { populate } = req.query;

            let query = Goal.findOne({ _id: id, userId });

            // Populate checkpoints if requested
            if (populate === 'checkpoints') {
                query = query.populate('checkpoints');
            }

            if (populate === 'all') {
                query = query.populate('checkpoints').populate('linkedTags', 'name color');
            }

            const goal = await query;

            if (!goal) {
                throw new CustomError('Goal not found', HTTP_STATUS.NOT_FOUND);
            }

            res.status(HTTP_STATUS.OK).json({
                success: true,
                data: goal
            });
        } catch (error) {
            next(error);
        }
    }

    static async updateGoal(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const userId = req.user!._id;
            const updates = req.body;

            // Prevent updating certain fields
            delete updates.userId;
            delete updates.year;
            delete updates.weekNumber;
            delete updates.weekStartDate;
            delete updates.weekEndDate;

            const goal = await Goal.findOneAndUpdate(
                { _id: id, userId },
                { $set: updates },
                { new: true, runValidators: true }
            ).populate('checkpoints');

            if (!goal) {
                throw new CustomError('Goal not found', HTTP_STATUS.NOT_FOUND);
            }

            res.status(HTTP_STATUS.OK).json({
                success: true,
                message: 'Weekly goal updated successfully',
                data: goal
            });
        } catch (error) {
            next(error);
        }
    }

    static async deleteGoal(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const userId = req.user!._id;

            const goal = await Goal.findOneAndDelete({ _id: id, userId });

            if (!goal) {
                throw new CustomError('Goal not found', HTTP_STATUS.NOT_FOUND);
            }

            res.status(HTTP_STATUS.OK).json({
                success: true,
                message: 'Goal deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }
}
