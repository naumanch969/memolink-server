import { Goal } from './goal.model';
import { logger } from '../../config/logger';
import { Types } from 'mongoose';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addWeeks, addMonths, addYears } from 'date-fns';

export class GoalService {
    /**
     * Auto-generate next period's goals for recurring goals
     * This should be run as a cron job or triggered when a period ends
     */
    static async generateRecurringGoals(userId: string) {
        try {
            const now = new Date();

            // Find all recurring goals that have ended
            const expiredRecurringGoals = await Goal.find({
                userId: new Types.ObjectId(userId),
                isRecurring: true,
                status: 'completed',
                periodEndDate: { $lte: now }
            });

            const newGoals = [];

            for (const goal of expiredRecurringGoals) {
                // Calculate next period dates
                let nextPeriodStart: Date;
                let nextPeriodEnd: Date;

                if (goal.recurrencePattern === 'weekly') {
                    nextPeriodStart = addWeeks(goal.periodStartDate || goal.startDate, 1);
                    nextPeriodEnd = endOfWeek(nextPeriodStart, { weekStartsOn: 1 });
                } else if (goal.recurrencePattern === 'monthly') {
                    nextPeriodStart = addMonths(goal.periodStartDate || goal.startDate, 1);
                    nextPeriodEnd = endOfMonth(nextPeriodStart);
                } else if (goal.recurrencePattern === 'yearly') {
                    nextPeriodStart = addYears(goal.periodStartDate || goal.startDate, 1);
                    nextPeriodEnd = endOfYear(nextPeriodStart);
                } else {
                    continue;
                }

                // Create new goal instance
                const newGoal = await Goal.create({
                    userId: goal.userId,
                    title: goal.title,
                    description: goal.description,
                    category: goal.category,
                    color: goal.color,
                    icon: goal.icon,
                    generatedTag: goal.generatedTag,
                    parentId: goal.parentId,
                    timeframe: goal.timeframe,
                    startDate: nextPeriodStart,
                    targetDate: nextPeriodEnd,
                    type: goal.type,
                    targetValue: goal.targetValue,
                    currentValue: 0, // Reset progress
                    unit: goal.unit,
                    linkedTags: goal.linkedTags,
                    linkedKeywords: goal.linkedKeywords,
                    status: 'active',
                    isRecurring: true,
                    recurrencePattern: goal.recurrencePattern,
                    periodStartDate: nextPeriodStart,
                    periodEndDate: nextPeriodEnd,
                    templateGoalId: goal.templateGoalId || goal._id // Link back to template
                });

                newGoals.push(newGoal);
                logger.info(`Generated recurring goal: ${newGoal.title} for period ${nextPeriodStart} - ${nextPeriodEnd}`);
            }

            return newGoals;
        } catch (error) {
            logger.error('Failed to generate recurring goals:', error);
            throw error;
        }
    }

    /**
     * Get goals for current period (this week, this month, this year)
     */
    static async getCurrentPeriodGoals(userId: string, period: 'week' | 'month' | 'year') {
        try {
            const now = new Date();
            let periodStart: Date;
            let periodEnd: Date;

            if (period === 'week') {
                periodStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
                periodEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
            } else if (period === 'month') {
                periodStart = startOfMonth(now);
                periodEnd = endOfMonth(now);
            } else {
                periodStart = startOfYear(now);
                periodEnd = endOfYear(now);
            }

            const goals = await Goal.find({
                userId: new Types.ObjectId(userId),
                status: 'active',
                periodStartDate: { $lte: periodEnd },
                periodEndDate: { $gte: periodStart }
            }).populate('linkedTags', 'name color');

            return goals;
        } catch (error) {
            logger.error('Failed to get current period goals:', error);
            throw error;
        }
    }
}

export const goalService = new GoalService();
