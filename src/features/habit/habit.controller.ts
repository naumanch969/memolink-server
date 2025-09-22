import { Request, Response, NextFunction } from 'express';
import { habitService } from './habit.service';
import { ResponseHelper } from '../../core/utils/response';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { AuthenticatedRequest } from '../../shared/types';
import { CreateHabitRequest, UpdateHabitRequest, CreateHabitLogRequest, UpdateHabitLogRequest } from './habit.interfaces';
import { Helpers } from '../../shared/helpers';

export class HabitController {
  static createHabit = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const habitData: CreateHabitRequest = req.body;
    const habit = await habitService.createHabit(userId, habitData);

    ResponseHelper.created(res, habit, 'Habit created successfully');
  });

  static getHabitById = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    const habit = await habitService.getHabitById(id, userId);

    ResponseHelper.success(res, habit, 'Habit retrieved successfully');
  });

  static getUserHabits = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { page, limit, status } = req.query;
    const { page: pageNum, limit: limitNum } = Helpers.getPaginationParams({ page, limit });

    const options = {
      page: pageNum,
      limit: limitNum,
      filter: status ? { status } : {},
    };

    const result = await habitService.getUserHabits(userId, options);

    ResponseHelper.paginated(res, result.habits, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    }, 'Habits retrieved successfully');
  });

  static updateHabit = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    const updateData: UpdateHabitRequest = req.body;
    const habit = await habitService.updateHabit(id, userId, updateData);

    ResponseHelper.success(res, habit, 'Habit updated successfully');
  });

  static deleteHabit = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    await habitService.deleteHabit(id, userId);

    ResponseHelper.success(res, null, 'Habit deleted successfully');
  });

  static createHabitLog = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const logData: CreateHabitLogRequest = req.body;
    const log = await habitService.createHabitLog(userId, logData);

    ResponseHelper.created(res, log, 'Habit log created successfully');
  });

  static updateHabitLog = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    const updateData: UpdateHabitLogRequest = req.body;
    const log = await habitService.updateHabitLog(id, userId, updateData);

    ResponseHelper.success(res, log, 'Habit log updated successfully');
  });

  static getHabitStreak = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const { id } = req.params;
    const streak = await habitService.getHabitStreak(id, userId);

    ResponseHelper.success(res, { streak }, 'Habit streak retrieved successfully');
  });

  static getHabitStats = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id.toString();
    const stats = await habitService.getHabitStats(userId);

    ResponseHelper.success(res, stats, 'Habit statistics retrieved successfully');
  });
}

export default HabitController;
