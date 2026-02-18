import { Types } from 'mongoose';
import { Schedule } from '../schedule/schedule.model';
import { ChallengeStatus, ChallengeType } from './challenge.interfaces';
import { Challenge, ChallengeLog } from './challenge.model';
import { challengeService } from './challenge.service';

// Mock the models
jest.mock('./challenge.model', () => {
    const mockC = {
        create: jest.fn(),
        countDocuments: jest.fn(),
        findById: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        findOneAndUpdate: jest.fn(),
        save: jest.fn(),
        updateMany: jest.fn(),
    };
    const mockCL = {
        findOneAndUpdate: jest.fn(),
        find: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnThis(),
        }),
    };
    return {
        Challenge: mockC,
        ChallengeLog: mockCL,
    };
});

jest.mock('../schedule/schedule.model', () => ({
    Schedule: {
        create: jest.fn(),
        updateMany: jest.fn(),
    }
}));

describe('ChallengeService', () => {
    const userId = new Types.ObjectId().toString();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('createChallenge', () => {
        it('should create a challenge and a schedule if within limit', async () => {
            const params = {
                title: 'Test Challenge',
                duration: 7 as const,
                type: ChallengeType.BINARY,
                reminderTime: '08:00'
            };

            (Challenge.countDocuments as jest.Mock).mockResolvedValue(0);
            (Challenge.create as jest.Mock).mockResolvedValue({
                _id: new Types.ObjectId(),
                ...params,
                status: ChallengeStatus.ACTIVE,
                startDate: new Date(),
                endDate: new Date(),
            });

            const result = await challengeService.createChallenge(userId, params);

            expect(Challenge.countDocuments).toHaveBeenCalled();
            expect(Challenge.create).toHaveBeenCalled();
            expect(Schedule.create).toHaveBeenCalled();
            expect(result).toBeDefined();
        });

        it('should throw error if active limit (3) is reached', async () => {
            (Challenge.countDocuments as jest.Mock).mockResolvedValue(3);

            await expect(challengeService.createChallenge(userId, {
                title: 'Wait',
                duration: 14,
                type: ChallengeType.BINARY
            })).rejects.toThrow('Focus limit reached');
        });
    });

    describe('logChallengeDay', () => {
        it('should log progress and update stats', async () => {
            const challengeId = new Types.ObjectId();
            const mockC = {
                _id: challengeId,
                startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                status: ChallengeStatus.ACTIVE,
                duration: 7,
                type: ChallengeType.BINARY
            };

            (Challenge.findOne as jest.Mock).mockResolvedValue(mockC);
            (ChallengeLog.findOneAndUpdate as jest.Mock).mockResolvedValue({ _id: 'log1' });

            const statsSpy = jest.spyOn(challengeService as any, 'updateChallengeStats').mockResolvedValue(undefined);

            const result = await challengeService.logChallengeDay(userId, {
                challengeId: challengeId.toString(),
                dayIndex: 1,
                status: 'completed'
            });

            expect(ChallengeLog.findOneAndUpdate).toHaveBeenCalled();
            expect(statsSpy).toHaveBeenCalledWith(challengeId.toString());
            expect(result).toBeDefined();
        });
    });

    describe('updateChallengeStats (Logic Check)', () => {
        const setupMock = (mockLogs: any[], mockChallengeOverrides = {}) => {
            const challengeId = new Types.ObjectId();
            const mockInst: any = {
                _id: challengeId,
                status: ChallengeStatus.ACTIVE,
                duration: 7,
                startDate: new Date(),
                config: { failureThreshold: 3 },
                stats: {
                    totalCompletions: 0,
                    missedDays: 0,
                    currentStreak: 0,
                    completionPercentage: 0,
                    lastLoggedDay: 0
                },
                save: jest.fn().mockResolvedValue(true),
                ...mockChallengeOverrides
            };

            (Challenge.findById as jest.Mock).mockResolvedValue(mockInst);

            const queryMock: any = {
                sort: jest.fn().mockResolvedValue(mockLogs)
            };
            (ChallengeLog.find as jest.Mock).mockReturnValue(queryMock);

            return { challengeId, mockInst };
        };

        it('should calculate streak and completion % correctly', async () => {
            const mockLogs = [
                { dayIndex: 1, status: 'completed' },
                { dayIndex: 2, status: 'completed' },
                { dayIndex: 3, status: 'missed' },
                { dayIndex: 4, status: 'completed' },
            ];

            const { challengeId, mockInst } = setupMock(mockLogs);

            // We are NOT mocking updateChallengeStats here, we want to test its REAL implementation
            await challengeService['updateChallengeStats'](challengeId.toString());

            expect(mockInst.stats.totalCompletions).toBe(3);
            expect(mockInst.stats.missedDays).toBe(1);
            expect(mockInst.stats.currentStreak).toBe(1);
            expect(mockInst.stats.completionPercentage).toBe(43);
            expect(mockInst.stats.lastLoggedDay).toBe(4);
        });

        it('should mark challenge as FAILED if missed threshold exceeded', async () => {
            const mockLogs = [
                { dayIndex: 1, status: 'missed' },
                { dayIndex: 2, status: 'missed' },
                { dayIndex: 3, status: 'missed' },
            ];

            const { challengeId, mockInst } = setupMock(mockLogs, { config: { failureThreshold: 3 } });

            await challengeService['updateChallengeStats'](challengeId.toString());

            expect(mockInst.status).toBe(ChallengeStatus.FAILED);
        });

        it('should mark challenge as COMPLETED if duration reached', async () => {
            const mockLogs = Array.from({ length: 7 }, (_, i) => ({ dayIndex: i + 1, status: 'completed' }));

            const { challengeId, mockInst } = setupMock(mockLogs, { duration: 7 });

            await challengeService['updateChallengeStats'](challengeId.toString());

            expect(mockInst.status).toBe(ChallengeStatus.COMPLETED);
        });
    });
});
