import { Types } from 'mongoose';
import { AgentTask } from '../agent/agent.model';
import { AgentTaskType } from '../agent/agent.types';
import { ReportType } from './report.interfaces';
import { Report } from './report.model';
import { ReportService } from './report.service';

// Mock models
jest.mock('./report.model');
jest.mock('../agent/agent.model');
jest.mock('../../config/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
    },
}));

describe('ReportService', () => {
    let reportService: ReportService;
    const userId = new Types.ObjectId().toString();

    beforeEach(() => {
        jest.clearAllMocks();
        reportService = new ReportService();
    });

    describe('createFromTask', () => {
        it('should create a weekly report from a completed weekly analysis task', async () => {
            const taskId = new Types.ObjectId().toString();
            const mockTask = {
                _id: taskId,
                userId,
                type: AgentTaskType.WEEKLY_ANALYSIS,
                status: 'COMPLETED',
                outputData: { summary: 'Weekly review' },
                completedAt: new Date(),
                updatedAt: new Date()
            };

            (AgentTask.findById as jest.Mock).mockResolvedValue(mockTask);
            (AgentTask.findById as jest.Mock).mockResolvedValue(mockTask);
            (Report.findOneAndUpdate as jest.Mock).mockResolvedValue({ _id: 'report123', isNew: true });

            const result = await reportService.createFromTask(userId, taskId);

            expect(Report.findOneAndUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: new Types.ObjectId(userId),
                    type: ReportType.WEEKLY,
                }),
                expect.objectContaining({
                    $set: expect.objectContaining({
                        content: mockTask.outputData
                    })
                }),
                expect.any(Object)
            );
            expect(result).toBeDefined();
        });

        it('should create a monthly report from a completed monthly analysis task', async () => {
            const taskId = new Types.ObjectId().toString();
            const mockTask = {
                _id: taskId,
                userId,
                type: AgentTaskType.MONTHLY_ANALYSIS,
                status: 'COMPLETED',
                outputData: { overview: 'Monthly summary' },
                completedAt: new Date(),
                updatedAt: new Date()
            };

            (AgentTask.findById as jest.Mock).mockResolvedValue(mockTask);
            (Report.findOneAndUpdate as jest.Mock).mockResolvedValue({ _id: 'report456', isNew: true });

            const result = await reportService.createFromTask(userId, taskId);

            expect(Report.findOneAndUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: new Types.ObjectId(userId),
                    type: ReportType.MONTHLY,
                }),
                expect.objectContaining({
                    $set: expect.objectContaining({
                        content: mockTask.outputData
                    })
                }),
                expect.any(Object)
            );
        });

        it('should throw error if task is not found', async () => {
            (AgentTask.findById as jest.Mock).mockResolvedValue(null);
            await expect(reportService.createFromTask(userId, 'invalid-id')).rejects.toThrow('Task not found');
        });
    });

    describe('listReports', () => {
        it('should list reports with pagination', async () => {
            const mockReports = [{ _id: 'r1' }, { _id: 'r2' }];
            const total = 2;

            const skipMock = jest.fn().mockReturnThis();
            const limitMock = jest.fn().mockReturnThis();
            const sortMock = jest.fn().mockReturnThis();
            const leanMock = jest.fn().mockResolvedValue(mockReports);

            (Report.find as jest.Mock).mockReturnValue({
                sort: sortMock,
                skip: skipMock,
                limit: limitMock,
                lean: leanMock
            });
            (Report.countDocuments as jest.Mock).mockResolvedValue(total);

            const result = await reportService.listReports(userId, { page: 1, limit: 10 });

            expect(result.reports).toEqual(mockReports);
            expect(result.total).toBe(total);
            expect(Report.find).toHaveBeenCalled();
        });
    });
});
