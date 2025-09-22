import { IHabit, IHabitLog } from '../../shared/types';

export interface IHabitService {
  createHabit(userId: string, habitData: CreateHabitRequest): Promise<IHabit>;
  getHabitById(habitId: string, userId: string): Promise<IHabit>;
  getUserHabits(userId: string, options?: any): Promise<{
    habits: IHabit[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  updateHabit(habitId: string, userId: string, updateData: UpdateHabitRequest): Promise<IHabit>;
  deleteHabit(habitId: string, userId: string): Promise<void>;
  createHabitLog(userId: string, logData: CreateHabitLogRequest): Promise<any>;
  updateHabitLog(logId: string, userId: string, updateData: UpdateHabitLogRequest): Promise<any>;
  getHabitStreak(habitId: string, userId: string): Promise<number>;
  getHabitStats(userId: string): Promise<any>;
}

export interface CreateHabitRequest {
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  customDays?: number[];
  targetCount?: number;
  unit?: string;
  startDate: Date;
  endDate?: Date;
  color?: string;
  icon?: string;
}

export interface UpdateHabitRequest {
  name?: string;
  description?: string;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'custom';
  customDays?: number[];
  targetCount?: number;
  unit?: string;
  status?: 'active' | 'paused' | 'completed' | 'archived';
  startDate?: Date;
  endDate?: Date;
  color?: string;
  icon?: string;
}

export interface CreateHabitLogRequest {
  habitId: string;
  date: Date;
  completed: boolean;
  count?: number;
  notes?: string;
  mood?: string;
}

export interface UpdateHabitLogRequest {
  completed?: boolean;
  count?: number;
  notes?: string;
  mood?: string;
}
