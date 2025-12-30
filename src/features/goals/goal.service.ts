import { Goal, Checkpoint } from './goal.model';
import { logger } from '../../config/logger';
import { Types } from 'mongoose';
import { ICheckpoint } from '../../shared/types';

export class GoalService {
    /**
     * Helper to calculate week start and end dates
     */
    getWeekDates(year: number, weekNumber: number): { start: Date; end: Date } {
        const jan4 = new Date(year, 0, 4);
        const dayOfWeek = jan4.getDay() || 7;
        const weekStart = new Date(jan4);
        weekStart.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNumber - 1) * 7);
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        return { start: weekStart, end: weekEnd };
    }

    /**
     * Create a new weekly goal
     */
    async createWeeklyGoal(userId: string, year: number, weekNumber: number) {
        try {
            // Check if goal already exists
            const existingGoal = await Goal.findOne({
                userId: new Types.ObjectId(userId),
                year,
                weekNumber
            });

            if (existingGoal) {
                // Return existing to be safe or throw? Controller throws. 
                // Let's throw matching logic from before.
                throw new Error('Goal already exists for this week');
            }

            const { start, end } = this.getWeekDates(year, weekNumber);

            const newGoal = await Goal.create({
                userId: new Types.ObjectId(userId),
                year,
                weekNumber,
                weekStartDate: start,
                weekEndDate: end,
                checkpoints: [], // Initialize empty
                status: 'active',
                currentValue: 0,
                targetValue: 0
            });

            logger.info(`Created weekly goal for user ${userId}: Week ${weekNumber}, ${year}`);
            return newGoal;
        } catch (error) {
            logger.error('Failed to create weekly goal:', error);
            throw error;
        }
    }

    /**
     * Get goals with checkpoints populated
     */
    async getGoals(userId: string, year?: number, status?: string) {
        try {
            const query: any = { userId: new Types.ObjectId(userId) };
            if (year) query.year = year;
            if (status) query.status = status;

            return await Goal.find(query)
                .populate('checkpoints')
                .sort({ year: 1, weekNumber: 1 });
        } catch (error) {
            logger.error('Failed to get goals:', error);
            throw error;
        }
    }

    /**
     * Create a new checkpoint for a goal
     */
    async createCheckpoint(userId: string, goalId: string, data: { title: string; description?: string; order?: number }) {
        let session = null;
        try {
            //Verify goal ownership
            const goal = await Goal.findOne({
                _id: new Types.ObjectId(goalId),
                userId: new Types.ObjectId(userId)
            });

            if (!goal) {
                throw new Error('Goal not found');
            }

            // Start transaction
            session = await Goal.startSession();
            session.startTransaction();

            // Create checkpoint
            const checkpoint = await Checkpoint.create([{
                goalId: goal._id,
                title: data.title,
                description: data.description,
                order: data.order ?? 0, // Default to 0 or we could count existing
                isCompleted: false
            }], { session });

            // Add to goal
            await Goal.updateOne(
                { _id: goal._id },
                { $push: { checkpoints: checkpoint[0]._id } },
                { session }
            );

            await session.commitTransaction();
            logger.info(`Created checkpoint ${checkpoint[0]._id} for goal ${goalId}`);
            return checkpoint[0];

        } catch (error) {
            if (session) await session.abortTransaction();
            logger.error('Failed to create checkpoint:', error);
            throw error;
        } finally {
            if (session) await session.endSession();
        }
    }

    /**
     * Update a checkpoint
     */
    async updateCheckpoint(userId: string, checkpointId: string, data: Partial<ICheckpoint>) {
        try {
            // Verify ownership via goal lookup
            const checkpoint = await Checkpoint.findById(checkpointId);
            if (!checkpoint) throw new Error('Checkpoint not found');

            const goal = await Goal.findOne({
                _id: checkpoint.goalId,
                userId: new Types.ObjectId(userId)
            });

            if (!goal) throw new Error('Unauthorized access to checkpoint');

            // Handle completion date logic
            const updateOp: any = { $set: data };

            if (data.isCompleted === true && !checkpoint.isCompleted) {
                if (!updateOp.$set) updateOp.$set = {};
                updateOp.$set.completedAt = new Date();
            } else if (data.isCompleted === false) {
                updateOp.$unset = { completedAt: 1 };
            }

            const updatedCheckpoint = await Checkpoint.findByIdAndUpdate(
                checkpointId,
                updateOp,
                { new: true }
            );

            return updatedCheckpoint;
        } catch (error) {
            logger.error('Failed to update checkpoint:', error);
            throw error;
        }
    }

    /**
     * Delete a checkpoint
     */
    async deleteCheckpoint(userId: string, checkpointId: string) {
        let session = null;
        try {
            const checkpoint = await Checkpoint.findById(checkpointId);
            if (!checkpoint) throw new Error('Checkpoint not found');

            const goal = await Goal.findOne({
                _id: checkpoint.goalId,
                userId: new Types.ObjectId(userId)
            });
            if (!goal) throw new Error('Unauthorized');

            session = await Goal.startSession();
            session.startTransaction();

            await Checkpoint.deleteOne({ _id: checkpointId }, { session });
            await Goal.updateOne(
                { _id: goal._id },
                { $pull: { checkpoints: checkpointId } },
                { session }
            );

            await session.commitTransaction();
            return { success: true };
        } catch (error) {
            if (session) await session.abortTransaction();
            logger.error('Failed to delete checkpoint:', error);
            throw error;
        } finally {
            if (session) await session.endSession();
        }
    }
}

export const goalService = new GoalService();
