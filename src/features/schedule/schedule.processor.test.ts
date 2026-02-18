import mongoose, { Types } from 'mongoose';
import { Challenge } from '../challenge/challenge.model';
import notificationDispatcher from '../notification/notification.dispatcher';
import { ScheduleAction, ScheduleStatus } from './schedule.interfaces';
import { Schedule } from './schedule.model';
import { processSchedules } from './schedule.processor';

// Mock mongoose connection state
Object.defineProperty(mongoose.connection, 'readyState', { value: 1 });

jest.mock('./schedule.model', () => ({
    Schedule: {
        findOneAndUpdate: jest.fn(),
    }
}));

jest.mock('../challenge/challenge.model', () => ({
    Challenge: {
        findById: jest.fn(),
    }
}));

jest.mock('../notification/notification.dispatcher', () => ({
    dispatch: jest.fn(),
}));

describe('ScheduleProcessor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should process due schedules and update nextRunAt for recurring actions', async () => {
        const scheduleId = new Types.ObjectId();
        const userId = new Types.ObjectId();
        const challengeId = new Types.ObjectId();

        const mockSchedule: any = {
            _id: scheduleId,
            userId,
            action: ScheduleAction.SEND_PUSH_NOTIFICATION,
            type: 'challenge',
            referenceModel: 'Challenge',
            referenceId: challengeId,
            payload: {
                title: 'Test',
                body: 'Test Body',
            },
            nextRunAt: new Date(Date.now() - 1000),
            cronExpression: '0 8 * * *',
            status: ScheduleStatus.ACTIVE,
            save: jest.fn().mockResolvedValue(true)
        };

        const mockChallenge = {
            _id: challengeId,
            title: 'Fitness',
            duration: 30,
            startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Day 6
            stats: { currentStreak: 5, missedDays: 0 }
        };

        (Schedule.findOneAndUpdate as jest.Mock)
            .mockResolvedValueOnce(mockSchedule)
            .mockResolvedValueOnce(null); // Second call break loop

        (Challenge.findById as jest.Mock).mockResolvedValue(mockChallenge);

        await processSchedules();

        // Should use dispatcher
        expect(notificationDispatcher.dispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: userId.toString(),
                message: expect.stringContaining('5 day streak')
            })
        );

        // Should save with nextRunAt
        expect(mockSchedule.save).toHaveBeenCalled();
        expect(mockSchedule.status).toBe(ScheduleStatus.ACTIVE);
        expect(mockSchedule.nextRunAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should handle missed days with motivational nudges', async () => {
        const scheduleId = new Types.ObjectId();
        const userId = new Types.ObjectId();
        const challengeId = new Types.ObjectId();

        const mockSchedule: any = {
            _id: scheduleId,
            userId,
            action: ScheduleAction.SEND_PUSH_NOTIFICATION,
            type: 'challenge',
            referenceModel: 'Challenge',
            referenceId: challengeId,
            payload: { title: 'T', body: 'B' },
            nextRunAt: new Date(),
            status: ScheduleStatus.ACTIVE,
            save: jest.fn().mockResolvedValue(true)
        };

        const mockChallenge = {
            _id: challengeId,
            title: 'Goal',
            duration: 14,
            startDate: new Date(),
            stats: { currentStreak: 0, missedDays: 2 }
        };

        (Schedule.findOneAndUpdate as jest.Mock)
            .mockResolvedValueOnce(mockSchedule)
            .mockResolvedValueOnce(null);

        (Challenge.findById as jest.Mock).mockResolvedValue(mockChallenge);

        await processSchedules();

        expect(notificationDispatcher.dispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining('perfect day to bounce back')
            })
        );
    });
});
