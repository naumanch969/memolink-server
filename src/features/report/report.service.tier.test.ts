import { Types } from 'mongoose';
import { User } from '../auth/auth.model';
import { Report } from './report.model';
import { ReportService } from './report.service';
import { ReportType, ReportStatus } from './report.types';
import { USER_ROLES } from '../../shared/constants';
import { Entry } from '../entry/entry.model';
import { AgentTask } from '../agent/agent.model';

// Mock models
jest.mock('./report.model');
jest.mock('../auth/auth.model');
jest.mock('../entry/entry.model');
jest.mock('../agent/agent.model');
jest.mock('../../config/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
}));
jest.mock('../../core/socket/socket.service', () => ({
    socketService: { emitToUser: jest.fn() },
}));
jest.mock('../agent/services/agent.service', () => ({
    agentService: { createTask: jest.fn().mockResolvedValue({ _id: 'task123' }) },
}));

describe('ReportService Tier and Eligibility', () => {
    let reportService: ReportService;
    const userId = new Types.ObjectId().toString();

    beforeEach(() => {
        jest.clearAllMocks();
        (AgentTask.findOne as jest.Mock).mockResolvedValue(null);
        reportService = new ReportService();
    });

    describe('generateOnDemand', () => {
        it('should allow generation if report does not exist and user is free', async () => {
            (User.findById as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue({ role: USER_ROLES.USER })
            });

            (Report.findOne as jest.Mock).mockResolvedValue(null);
            
            // Mock eligibility to pass
            jest.spyOn(reportService, 'checkEligibility').mockResolvedValue({
                isEligible: true,
                metrics: { entryCount: 10, wordCount: 1000, uniqueDays: 4 },
                thresholds: { minEntries: 3, minWords: 300, minDays: 3 }
            });

            const result = await reportService.generateOnDemand(userId, ReportType.WEEKLY);
            expect(result).toBeDefined();
            expect(result.taskId).toBe('task123');
        });

        it('should throw error if report exists and user is free', async () => {
            (User.findById as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue({ role: USER_ROLES.USER })
            });

            (Report.findOne as jest.Mock).mockResolvedValue({ _id: 'existing-report', status: ReportStatus.PUBLISHED });

            await expect(reportService.generateOnDemand(userId, ReportType.WEEKLY))
                .rejects.toThrow('Regeneration is a Pro-only feature');
        });

        it('should allow regeneration if report exists and user is pro', async () => {
            (User.findById as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue({ role: USER_ROLES.PRO })
            });

            (Report.findOne as jest.Mock).mockResolvedValue({ _id: 'existing-report', status: ReportStatus.PUBLISHED });

            // Mock eligibility to pass
            jest.spyOn(reportService, 'checkEligibility').mockResolvedValue({
                isEligible: true,
                metrics: { entryCount: 10, wordCount: 1000, uniqueDays: 4 },
                thresholds: { minEntries: 3, minWords: 300, minDays: 3 }
            });

            const result = await reportService.generateOnDemand(userId, ReportType.WEEKLY);
            expect(result).toBeDefined();
        });

        it('should allow regeneration if report exists and user is admin', async () => {
            (User.findById as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue({ role: USER_ROLES.ADMIN })
            });

            (Report.findOne as jest.Mock).mockResolvedValue({ _id: 'existing-report', status: ReportStatus.PUBLISHED });

            // Mock eligibility to pass
            jest.spyOn(reportService, 'checkEligibility').mockResolvedValue({
                isEligible: true,
                metrics: { entryCount: 10, wordCount: 1000, uniqueDays: 4 },
                thresholds: { minEntries: 3, minWords: 300, minDays: 3 }
            });

            const result = await reportService.generateOnDemand(userId, ReportType.WEEKLY);
            expect(result).toBeDefined();
        });

        it('should throw error if user is not eligible', async () => {
            (User.findById as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue({ role: USER_ROLES.ADMIN })
            });

            (Report.findOne as jest.Mock).mockResolvedValue(null);

            // Mock eligibility to fail
            jest.spyOn(reportService, 'checkEligibility').mockResolvedValue({
                isEligible: false,
                metrics: { entryCount: 1, wordCount: 10, uniqueDays: 1 },
                thresholds: { minEntries: 3, minWords: 300, minDays: 3 }
            });

            await expect(reportService.generateOnDemand(userId, ReportType.WEEKLY))
                .rejects.toThrow('Low data signal');
        });
    });

    describe('checkEligibility', () => {
        it('should return isEligible true when thresholds are met', async () => {
            const mockEntries = [
                { date: new Date('2024-01-01'), content: 'Word '.repeat(100) },
                { date: new Date('2024-01-02'), content: 'Word '.repeat(100) },
                { date: new Date('2024-01-03'), content: 'Word '.repeat(101) },
            ];

            (Entry.find as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockEntries)
            });

            const result = await reportService.checkEligibility(userId, ReportType.WEEKLY, new Date('2024-01-01'), new Date('2024-01-07'));
            
            expect(result.isEligible).toBe(true);
            expect(result.metrics.entryCount).toBe(3);
            expect(result.metrics.wordCount).toBe(301);
            expect(result.metrics.uniqueDays).toBe(3);
        });

        it('should return isEligible false when thresholds are not met', async () => {
            const mockEntries = [
                { date: new Date('2024-01-01'), content: 'Too short' },
            ];

            (Entry.find as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockEntries)
            });

            const result = await reportService.checkEligibility(userId, ReportType.WEEKLY, new Date('2024-01-01'), new Date('2024-01-07'));
            
            expect(result.isEligible).toBe(false);
        });
    });
});
