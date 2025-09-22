import mongoose, { Schema } from 'mongoose';
import { IHabit, IHabitLog } from '../../shared/types';

const habitSchema = new Schema<IHabit>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Habit name cannot exceed 100 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'custom'],
    required: true,
  },
  customDays: [{
    type: Number,
    min: 0,
    max: 6,
  }],
  targetCount: {
    type: Number,
    min: 1,
  },
  unit: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'archived'],
    default: 'active',
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
  },
  color: {
    type: String,
    trim: true,
  },
  icon: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

const habitLogSchema = new Schema<IHabitLog>({
  habitId: {
    type: Schema.Types.ObjectId,
    ref: 'Habit',
    required: true,
    index: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  date: {
    type: Date,
    required: true,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  count: {
    type: Number,
    min: 0,
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
  },
  mood: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

habitSchema.index({ userId: 1, status: 1 });
habitLogSchema.index({ habitId: 1, date: 1 }, { unique: true });

export const Habit = mongoose.model<IHabit>('Habit', habitSchema);
export const HabitLog = mongoose.model<IHabitLog>('HabitLog', habitLogSchema);
export default Habit;
