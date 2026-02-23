import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { GOAL_STATUS } from '../../shared/constants';
import { StreakUtil } from '../../shared/utils/streak.utils';
import { GoalPeriod, IGoal, IGoalProgressService, UpdateGoalProgressParams } from './goal.interfaces';
import Goal from './goal.model';

export class GoalProgressService implements IGoalProgressService {
    /**
     * Updates progress for a goal, records history logs, recomputes streaks,
     * handles completion triggers, and rolls up progress to parents.
     */
    async updateProgress(userId: string, goalId: string, params: UpdateGoalProgressParams): Promise<IGoal | null> {
        const goal = await Goal.findOne({
            _id: new Types.ObjectId(goalId),
            userId: new Types.ObjectId(userId)
        });

        if (!goal) return null;

        if (params.notes) {
            goal.progress.notes = params.notes;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const isBoolean = goal.trackingConfig?.type === 'boolean';
        const logValue = typeof params.value === 'number' ? params.value : 1;

        const existingTodayIdx = goal.progressLogs.findIndex(
            l => new Date(l.date).toDateString() === today.toDateString()
        );

        let delta = 0;
        if (existingTodayIdx >= 0) {
            const oldVal = goal.progressLogs[existingTodayIdx].value;
            if (params.mode === 'add') {
                const newVal = isBoolean ? 1 : oldVal + logValue;
                delta = newVal - oldVal;
                goal.progressLogs[existingTodayIdx].value = newVal;
            } else {
                delta = logValue - oldVal;
                goal.progressLogs[existingTodayIdx].value = logValue;
            }
        } else {
            delta = logValue;
            goal.progressLogs.push({ date: today, value: logValue });
            goal.progress.totalCompletions = (goal.progress.totalCompletions ?? 0) + 1;
        }

        // Update total currentValue
        if (params.mode === 'add' || params.mode === 'set') {
            if (existingTodayIdx >= 0 && params.mode === 'set') {
                goal.progress.currentValue = (goal.progress.currentValue ?? 0) + delta;
            } else if (params.mode === 'add') {
                goal.progress.currentValue = (goal.progress.currentValue ?? 0) + delta;
            } else if (existingTodayIdx < 0 && params.mode === 'set') {
                goal.progress.currentValue = (goal.progress.currentValue ?? 0) + logValue;
            }
        }

        // ──────────────────────────────────────────────────────────
        // 3. Recompute current streak using StreakUtil
        // ──────────────────────────────────────────────────────────
        const streakResult = StreakUtil.calculate(goal.progressLogs.map(l => l.date), 1); // Strict for goals

        goal.progress.streakCurrent = streakResult.currentStreak;
        goal.progress.streakLongest = Math.max(
            goal.progress.streakLongest ?? 0,
            streakResult.longestStreak
        );
        goal.progress.lastLogDate = today;
        goal.progress.lastUpdate = new Date();

        // ──────────────────────────────────────────────────────────
        // 4. Auto-complete when 100% reached
        // ──────────────────────────────────────────────────────────
        const target = goal.trackingConfig?.targetValue;
        const current = goal.progress.currentValue ?? 0;
        const isOngoing = goal.period === GoalPeriod.INDEFINITE;

        if (!isOngoing && target && target > 0 && current >= target) {
            if (goal.status === GOAL_STATUS.ACTIVE) {
                goal.status = GOAL_STATUS.COMPLETED;
            }
        }

        await goal.save();

        // ──────────────────────────────────────────────────────────
        // 5. Roll up progress to parent if exists
        // ──────────────────────────────────────────────────────────
        if (goal.parentId && delta !== 0) {
            await this.updateProgress(userId, goal.parentId.toString(), {
                value: delta,
                mode: 'add'
            }).catch(err => logger.error(`[GoalProgressService] Parent rollup failed for goal ${goal._id}`, err));
        }

        return goal.toObject();
    }
}

export const goalProgressService = new GoalProgressService();
