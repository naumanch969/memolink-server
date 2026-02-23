import { addDays, addYears } from 'date-fns';
import { Types } from 'mongoose';
import logger from '../../config/logger';
import { ApiError } from '../../core/errors/api.error';
import { GOAL_STATUS } from '../../shared/constants';
import { MongoUtil } from '../../shared/utils/mongo.util';
import { EdgeType, NodeType } from '../graph/edge.model';
import { graphService } from '../graph/graph.service';
import { goalProgressService } from './goal-progress.service';
import { goalReminderService } from './goal-reminder.service';
import { CreateGoalParams, GetGoalsQuery, GoalPeriod, IGoal, IGoalService, UpdateGoalParams, UpdateGoalProgressParams } from './goal.interfaces';
import Goal from './goal.model';

export class GoalService implements IGoalService {
    /**
     * Create new Goal, calculate deadlines, and setup automation
     */
    async createGoal(userId: string | Types.ObjectId, params: CreateGoalParams): Promise<IGoal> {
        try {
            const startDate = params.startDate ? new Date(params.startDate) : new Date();
            let deadline = params.deadline ? new Date(params.deadline) : undefined;

            if (!deadline && params.period && params.period !== GoalPeriod.INDEFINITE) {
                deadline = this._calculateProjectedDeadline(startDate, params.period);
            }

            const goal = await Goal.create({
                userId: new Types.ObjectId(userId),
                ...params,
                deadline,
                startDate,
                tags: params.tags?.map(id => new Types.ObjectId(id)),
                metadata: params.metadata,
            });

            // Automation: Setup initial reminders
            await goalReminderService.manageReminders(userId, goal);

            // Graph: Record association
            await graphService.createAssociation({
                fromId: userId,
                fromType: NodeType.USER,
                toId: goal._id.toString(),
                toType: NodeType.GOAL,
                relation: EdgeType.HAS_GOAL,
                metadata: { title: goal.title }
            }).catch(err => logger.error(`[GoalService] Graph association failed`, err));

            return (await Goal.findById(goal._id).lean()) as IGoal;
        } catch (error: any) {
            if (MongoUtil.isMongoError(error) && error.code === 11000) {
                throw ApiError.conflict('An active goal with this title already exists.');
            }
            throw error;
        }
    }

    /**
     * List goals for user with filtering
     */
    async getGoals(userId: string, query: GetGoalsQuery): Promise<IGoal[]> {
        const filter: any = { userId: new Types.ObjectId(userId) };

        if (query.status && query.status !== 'all') {
            filter.status = query.status;
        } else if (!query.status) {
            filter.status = { $ne: GOAL_STATUS.ARCHIVED };
        }

        if (query.period) filter.period = query.period;
        if (query.priority) filter.priority = query.priority;

        if (query.hasDeadline === true) {
            filter.deadline = { $exists: true, $ne: null };
        } else if (query.hasDeadline === false) {
            filter.deadline = { $exists: false };
        }

        return Goal.find(filter)
            .sort({ priority: -1, deadline: 1, createdAt: -1 })
            .lean() as unknown as IGoal[];
    }

    async getGoalById(userId: string, goalId: string): Promise<IGoal | null> {
        return Goal.findOne({
            _id: new Types.ObjectId(goalId),
            userId: new Types.ObjectId(userId),
        }).lean() as unknown as IGoal | null;
    }

    /**
     * Update goal properties and refresh automation if needed
     */
    async updateGoal(userId: string, goalId: string, params: UpdateGoalParams): Promise<IGoal | null> {
        const updateData: any = { ...params };

        if (params.tags) {
            updateData.tags = params.tags.map(id => new Types.ObjectId(id));
        }

        const goal = await Goal.findOneAndUpdate(
            {
                _id: new Types.ObjectId(goalId),
                userId: new Types.ObjectId(userId)
            },
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (goal && (params.period || params.trackingSchedule)) {
            await goalReminderService.manageReminders(userId, goal);
        }

        return goal ? goal.toObject() : null;
    }

    /**
     * Delegate complex progress logic to GoalProgressService
     */
    async updateProgress(userId: string, goalId: string, params: UpdateGoalProgressParams): Promise<IGoal | null> {
        return goalProgressService.updateProgress(userId, goalId, params);
    }

    /**
     * Delete goal and cleanup graph edges
     */
    async deleteGoal(userId: string, goalId: string): Promise<boolean> {
        const result = await Goal.deleteOne({
            _id: new Types.ObjectId(goalId),
            userId: new Types.ObjectId(userId),
        });

        if (result.deletedCount === 1) {
            await graphService.removeNodeEdges(goalId).catch(err => logger.error(`[GoalService] Graph cleanup failed`, err));
        }

        return result.deletedCount === 1;
    }

    async deleteUserData(userId: string): Promise<number> {
        const result = await Goal.deleteMany({ userId });
        logger.info(`Deleted ${result.deletedCount} goals for user ${userId}`);
        return result.deletedCount || 0;
    }

    /**
     * Private: Logic for calculating deadlines based on goal period
     */
    private _calculateProjectedDeadline(startDate: Date, period: GoalPeriod): Date {
        switch (period) {
            case GoalPeriod.WEEKLY:
                return addDays(startDate, 7);
            case GoalPeriod.MONTHLY:
                return addDays(startDate, 30);
            case GoalPeriod.YEARLY:
                return addDays(startDate, 365);
            default:
                return addYears(startDate, 1);
        }
    }
}

export const goalService = new GoalService();
export default goalService;
