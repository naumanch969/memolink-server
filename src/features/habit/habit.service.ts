import { Habit, HabitLog } from './habit.model';
import { logger } from '../../config/logger';
import { createNotFoundError } from '../../core/middleware/errorHandler';
import { CreateHabitRequest, UpdateHabitRequest, CreateHabitLogRequest, UpdateHabitLogRequest, IHabitService } from './habit.interfaces';
import { Helpers } from '../../shared/helpers';
import { Types } from 'mongoose';
import { IHabit, IHabitLog, } from '../../shared/types';

export class HabitService implements IHabitService  {
  async createHabit(userId: string, habitData: CreateHabitRequest): Promise<IHabit> {
    try {
      const habit = new Habit({
        userId: new Types.ObjectId(userId),
        ...habitData,
      });

      await habit.save();
      logger.info('Habit created successfully', { habitId: habit._id, userId });
      return habit;
    } catch (error) {
      logger.error('Habit creation failed:', error);
      throw error;
    }
  }

  async getHabitById(habitId: string, userId: string): Promise<IHabit> {
    try {
      const habit = await Habit.findOne({ _id: habitId, userId });
      if (!habit) {
        throw createNotFoundError('Habit');
      }
      return habit;
    } catch (error) {
      logger.error('Get habit by ID failed:', error);
      throw error;
    }
  }

  async getUserHabits(userId: string, options: any = {}): Promise<{
    habits: IHabit[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const { page, limit, skip } = Helpers.getPaginationParams(options);
      const sort = Helpers.getSortParams(options, 'createdAt');

      const [habits, total] = await Promise.all([
        Habit.find({ userId }).sort(sort as any).skip(skip).limit(limit),
        Habit.countDocuments({ userId }),
      ]);

      const totalPages = Math.ceil(total / limit);
      return { habits, total, page, limit, totalPages };
    } catch (error) {
      logger.error('Get user habits failed:', error);
      throw error;
    }
  }

  async updateHabit(habitId: string, userId: string, updateData: UpdateHabitRequest): Promise<IHabit> {
    try {
      const habit = await Habit.findOneAndUpdate(
        { _id: habitId, userId },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!habit) {
        throw createNotFoundError('Habit');
      }

      logger.info('Habit updated successfully', { habitId: habit._id, userId });
      return habit;
    } catch (error) {
      logger.error('Habit update failed:', error);
      throw error;
    }
  }

  async deleteHabit(habitId: string, userId: string): Promise<void> {
    try {
      const habit = await Habit.findOneAndDelete({ _id: habitId, userId });
      if (!habit) {
        throw createNotFoundError('Habit');
      }
      logger.info('Habit deleted successfully', { habitId: habit._id, userId });
    } catch (error) {
      logger.error('Habit deletion failed:', error);
      throw error;
    }
  }

  async createHabitLog(userId: string, logData: CreateHabitLogRequest): Promise<any> {
    try {
      const log = new HabitLog({
        userId: new Types.ObjectId(userId),
        habitId: new Types.ObjectId(logData.habitId),
        ...logData,
      });

      await log.save();
      logger.info('Habit log created successfully', { logId: log._id, userId });
      return log;
    } catch (error) {
      logger.error('Habit log creation failed:', error);
      throw error;
    }
  }

  async updateHabitLog(logId: string, userId: string, updateData: UpdateHabitLogRequest): Promise<any> {
    try {
      const log = await HabitLog.findOneAndUpdate(
        { _id: logId, userId },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!log) {
        throw createNotFoundError('Habit log');
      }

      logger.info('Habit log updated successfully', { logId: log._id, userId });
      return log;
    } catch (error) {
      logger.error('Habit log update failed:', error);
      throw error;
    }
  }

  async getHabitStreak(habitId: string, userId: string): Promise<number> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const habitObjectId = new Types.ObjectId(habitId);

      // Get all completed logs for this habit, sorted by date descending
      const logs = await HabitLog.find({
        habitId: habitObjectId,
        userId: userObjectId,
        completed: true,
      }).sort({ date: -1 });

      if (logs.length === 0) return 0;

      let streak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if today is completed
      const todayLog = logs.find(log => {
        const logDate = new Date(log.date);
        logDate.setHours(0, 0, 0, 0);
        return logDate.getTime() === today.getTime();
      });

      if (!todayLog) {
        // If today is not completed, check yesterday
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const yesterdayLog = logs.find(log => {
          const logDate = new Date(log.date);
          logDate.setHours(0, 0, 0, 0);
          return logDate.getTime() === yesterday.getTime();
        });

        if (!yesterdayLog) return 0;
      }

      // Count consecutive days
      let currentDate = new Date(today);
      if (!todayLog) {
        currentDate.setDate(currentDate.getDate() - 1);
      }

      for (const log of logs) {
        const logDate = new Date(log.date);
        logDate.setHours(0, 0, 0, 0);

        if (logDate.getTime() === currentDate.getTime()) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else if (logDate.getTime() < currentDate.getTime()) {
          break;
        }
      }

      return streak;
    } catch (error) {
      logger.error('Get habit streak failed:', error);
      throw error;
    }
  }

  async getHabitStats(userId: string): Promise<{
    totalHabits: number;
    activeHabits: number;
    completedToday: number;
    longestStreak: number;
    averageCompletion: number;
  }> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [
        totalHabits,
        activeHabits,
        completedToday,
        habitCompletionStats,
      ] = await Promise.all([
        Habit.countDocuments({ userId: userObjectId }),
        Habit.countDocuments({ userId: userObjectId, status: 'active' }),
        HabitLog.countDocuments({
          userId: userObjectId,
          date: { $gte: startOfDay },
          completed: true
        }),
        HabitLog.aggregate([
          { $match: { userId: userObjectId } },
          {
            $group: {
              _id: '$habitId',
              totalLogs: { $sum: 1 },
              completedLogs: { $sum: { $cond: ['$completed', 1, 0] } },
            },
          },
          {
            $group: {
              _id: null,
              averageCompletion: { $avg: { $divide: ['$completedLogs', '$totalLogs'] } },
            },
          },
        ]),
      ]);

      // Get longest streak across all habits
      const habits = await Habit.find({ userId: userObjectId });
      let longestStreak = 0;

      for (const habit of habits) {
        const streak = await this.getHabitStreak(habit._id.toString(), userId);
        if (streak > longestStreak) {
          longestStreak = streak;
        }
      }

      return {
        totalHabits,
        activeHabits,
        completedToday,
        longestStreak,
        averageCompletion: habitCompletionStats[0]?.averageCompletion || 0,
      };
    } catch (error) {
      logger.error('Get habit stats failed:', error);
      throw error;
    }
  }
}

export const habitService = new HabitService();

export default HabitService;
