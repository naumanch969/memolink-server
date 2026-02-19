import { isAfter, startOfDay, subDays } from 'date-fns';
import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { GOAL_STATUS } from '../../shared/constants';
import { User } from '../auth/auth.model';
import { Entry } from '../entry/entry.model';
import Goal from '../goal/goal.model';
import notificationService from '../notification/notification.service';
import { NotificationType } from '../notification/notification.types';
import { RoutineLog, RoutineTemplate } from '../routine/routine.model';

export class AgentAccountability {
    /**
     * Runs the accountability loop for all active users
     */
    async runAccountabilityLoop() {
        logger.info('Starting Agent Accountability Loop...');
        try {
            const users = await User.find({ isActive: true });

            for (const user of users) {
                await this.checkUserAccountability(user._id.toString());
            }

            logger.info('Agent Accountability Loop completed.');
        } catch (error) {
            logger.error('Accountability loop failed:', error);
        }
    }

    private async checkUserAccountability(userId: string) {
        try {
            // 1. Check for Slipping Goals
            await this.checkSlippingGoals(userId);

            // 2. Check for Missed Routines (only if it's evening)
            const currentHour = new Date().getHours();
            if (currentHour >= 18) { // 6 PM onwards
                await this.checkMissedRoutines(userId);
            }

            // 3. Check for Radio Silence
            await this.checkInactivity(userId);

        } catch (error) {
            logger.error(`Accountability check failed for user ${userId}:`, error);
        }
    }

    private async checkSlippingGoals(userId: string) {
        const now = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(now.getDate() + 7);

        // Find goals due soon
        const slippingGoals = await Goal.find({
            userId,
            status: GOAL_STATUS.ACTIVE,
            deadline: { $lte: nextWeek, $gte: now }
        });

        for (const goal of slippingGoals) {
            // Check if already nudged today for THIS goal
            if (await this.wasNudgedToday(userId, goal._id.toString())) continue;

            const progress = (goal.progress as any).currentValue || 0;
            const target = (goal.trackingConfig as any)?.targetValue || 100;

            if ((progress / target) < 0.5) {
                await notificationService.create({
                    userId,
                    type: NotificationType.NUDGE,
                    title: `Goal Nudge: ${goal.title}`,
                    message: `You're halfway through time but under 50% on "${goal.title}". Your Chief of Staff is here if you need a plan to catch up!`,
                    referenceId: goal._id.toString(),
                    referenceModel: 'Goal',
                    actionUrl: `/partner`
                });
            }
        }
    }

    private async checkMissedRoutines(userId: string) {
        const today = startOfDay(new Date());
        const dayOfWeek = today.getDay(); // 0-6

        // Find active routines for today
        const activeRoutines = await RoutineTemplate.find({
            userId,
            status: 'active',
            'schedule.days': dayOfWeek
        });

        for (const routine of activeRoutines) {
            // Check if already nudged today for THIS routine
            if (await this.wasNudgedToday(userId, routine._id.toString())) continue;

            // Check if logged today
            const log = await RoutineLog.findOne({
                userId,
                routineId: routine._id,
                date: today
            });

            if (!log) {
                await notificationService.create({
                    userId,
                    type: NotificationType.NUDGE,
                    title: `Routine Check: ${routine.name}`,
                    message: `Don't let the streak break! You haven't checked in on "${routine.name}" today.`,
                    referenceId: routine._id.toString(),
                    referenceModel: 'RoutineTemplate', // Match naming convention in other models
                    actionUrl: `/routines`
                });
            }
        }
    }

    private async checkInactivity(userId: string) {
        // Check if already nudged today for inactivity
        if (await this.wasNudgedToday(userId, 'Inactivity')) return;

        const fortyEightHoursAgo = subDays(new Date(), 2);

        const lastEntry = await Entry.findOne({ userId })
            .sort({ date: -1 })
            .select('date');

        if (!lastEntry || !isAfter(new Date(lastEntry.date), fortyEightHoursAgo)) {
            // No activity in last 48 hours
            await notificationService.create({
                userId,
                type: NotificationType.NUDGE,
                title: "Ghosting your memories?",
                message: "It's been a couple of days since your last capture. Your future self will thank you for documenting even the small things today.",
                referenceId: new Types.ObjectId().toString(),
                referenceModel: 'Inactivity',
                actionUrl: `/dashboard`
            });
        }
    }

    private async wasNudgedToday(userId: string, targetId: string): Promise<boolean> {
        const { Notification } = await import('../notification/notification.model');
        const today = startOfDay(new Date());

        const query: any = {
            userId: new Types.ObjectId(userId),
            type: NotificationType.NUDGE,
            createdAt: { $gte: today }
        };

        if (Types.ObjectId.isValid(targetId)) {
            query.referenceId = new Types.ObjectId(targetId);
        } else {
            query.referenceModel = targetId;
        }

        const existing = await Notification.findOne(query);
        return !!existing;
    }
}

export const agentAccountability = new AgentAccountability();
