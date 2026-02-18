import { Types } from 'mongoose';
import { ApiError } from '../../core/errors/api.error';
import { ScheduleAction, ScheduleStatus } from '../schedule/schedule.interfaces';
import { Schedule } from '../schedule/schedule.model';
import { ChallengeStatus, CreateChallengeLogParams, CreateChallengeParams, IChallenge, IChallengeLog } from './challenge.interfaces';
import { Challenge, ChallengeLog } from './challenge.model';

export class ChallengeService {

    async createChallenge(userId: string, params: CreateChallengeParams): Promise<IChallenge> {
        // 1. Focus Enforcer: Check for active challenges limit (max 3)
        const activeCount = await Challenge.countDocuments({
            userId: new Types.ObjectId(userId),
            status: ChallengeStatus.ACTIVE
        });

        if (activeCount >= 3) {
            throw ApiError.badRequest('Focus limit reached. You can only have 3 active challenges at a time.');
        }

        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0); // Normalize to start of day

        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + params.duration);

        const challenge = await Challenge.create({
            userId: new Types.ObjectId(userId),
            goalId: params.goalId ? new Types.ObjectId(params.goalId) : undefined,
            title: params.title,
            description: params.description,
            duration: params.duration,
            type: params.type,
            startDate,
            endDate,
            config: params.config || {},
            status: ChallengeStatus.ACTIVE,
            stats: {
                completionPercentage: 0,
                currentStreak: 0,
                totalCompletions: 0,
                missedDays: 0
            }
        });

        // 2. Create Schedule for Daily Notification if reminderTime is provided
        if (params.reminderTime) {
            const [hours, minutes] = params.reminderTime.split(':').map(Number);
            const nextRun = new Date();
            nextRun.setHours(hours, minutes, 0, 0);

            // If already passed for today, set for tomorrow
            if (nextRun < new Date()) {
                nextRun.setDate(nextRun.getDate() + 1);
            }

            await Schedule.create({
                userId: new Types.ObjectId(userId),
                type: 'challenge',
                action: ScheduleAction.SEND_PUSH_NOTIFICATION,
                payload: {
                    challengeId: challenge._id,
                    title: `Day 1/${params.duration}: ${challenge.title}`,
                    body: "Time to log today's progress!",
                    category: 'CHALLENGE_LOG_ACTION'
                },
                nextRunAt: nextRun,
                cronExpression: `${minutes} ${hours} * * *`, // Daily
                referenceId: challenge._id,
                referenceModel: 'Challenge',
                status: ScheduleStatus.ACTIVE
            });
        }

        return challenge;
    }

    async getActiveChallenges(userId: string): Promise<IChallenge[]> {
        return Challenge.find({
            userId: new Types.ObjectId(userId),
            status: ChallengeStatus.ACTIVE
        }).sort({ createdAt: 1 });
    }

    async logChallengeDay(userId: string, params: CreateChallengeLogParams): Promise<IChallengeLog> {
        const challenge = await Challenge.findOne({
            _id: new Types.ObjectId(params.challengeId),
            userId: new Types.ObjectId(userId)
        });

        if (!challenge) {
            throw ApiError.notFound('Challenge not found');
        }

        const logDate = params.date ? new Date(params.date) : new Date();
        logDate.setHours(0, 0, 0, 0);

        // Calculate day index if not provided or to verify
        const diffTime = Math.abs(logDate.getTime() - challenge.startDate.getTime());
        const calculatedDayIndex = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        const dayIndex = params.dayIndex || calculatedDayIndex;

        if (dayIndex < 1 || dayIndex > challenge.duration) {
            throw ApiError.badRequest('Invalid day index for this challenge duration');
        }

        const log = await ChallengeLog.findOneAndUpdate(
            {
                challengeId: challenge._id,
                dayIndex
            },
            {
                userId: new Types.ObjectId(userId),
                challengeId: challenge._id,
                dayIndex,
                date: logDate,
                status: params.status,
                value: params.value,
                notes: params.notes,
                loggedAt: new Date()
            },
            { upsert: true, new: true }
        );

        // Trigger Stats Update
        await this.updateChallengeStats(challenge._id.toString());

        return log;
    }

    private async updateChallengeStats(challengeId: string) {
        const logs = await ChallengeLog.find({ challengeId: new Types.ObjectId(challengeId) }).sort({ dayIndex: 1 });
        const challenge = await Challenge.findById(challengeId);
        if (!challenge) return;

        let totalCompletions = 0;
        let missedDays = 0;
        let currentStreak = 0;
        let lastDay = 0;

        logs.forEach(log => {
            if (log.status === 'completed') {
                totalCompletions++;
                currentStreak++;
            } else if (log.status === 'missed') {
                missedDays++;
                currentStreak = 0;
            }
            if (log.dayIndex > lastDay) lastDay = log.dayIndex;
        });

        challenge.stats.totalCompletions = totalCompletions;
        challenge.stats.missedDays = missedDays;
        challenge.stats.currentStreak = currentStreak;
        challenge.stats.completionPercentage = Math.round((totalCompletions / challenge.duration) * 100);
        challenge.stats.lastLoggedDay = lastDay;

        // Auto-Complete if duration reached
        if (lastDay === challenge.duration && challenge.status === ChallengeStatus.ACTIVE) {
            challenge.status = ChallengeStatus.COMPLETED;
            // Deactivate Schedule
            await Schedule.updateMany(
                { referenceId: challenge._id, referenceModel: 'Challenge' },
                { status: ScheduleStatus.COMPLETED }
            );
        }

        // Auto-Fail Check: e.g. if missed more than threshold
        if (challenge.stats.missedDays >= (challenge.config.failureThreshold || 3)) {
            challenge.status = ChallengeStatus.FAILED;
            await Schedule.updateMany(
                { referenceId: challenge._id, referenceModel: 'Challenge' },
                { status: ScheduleStatus.PAUSED }
            );
        }

        await challenge.save();
    }
}

export const challengeService = new ChallengeService();
export default challengeService;
