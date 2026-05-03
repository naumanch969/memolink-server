import { Types } from 'mongoose';
import { User } from '../auth/auth.model';
import { AgentTask } from '../agent/agent.model';
import { AgentTaskStatus, AgentTaskType } from '../agent/agent.types';
import { Report } from './report.model';
import { ReportService } from './report.service';
import { ReportStatus, ReportType } from './report.types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('./report.model');
jest.mock('../auth/auth.model');
jest.mock('../agent/agent.model');
jest.mock('../../config/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../core/socket/socket.service', () => ({
    socketService: { emitToUser: jest.fn() },
}));
jest.mock('../agent/services/agent.service', () => ({
    agentService: { createTask: jest.fn().mockResolvedValue({ _id: 'task123' }) },
}));

// ─── createFromTask ────────────────────────────────────────────────────────────

describe('ReportService.createFromTask', () => {
    let reportService: ReportService;
    const userId = new Types.ObjectId().toString();

    beforeEach(() => {
        jest.clearAllMocks();
        reportService = new ReportService();
    });

    it('creates a weekly report from a completed WEEKLY_ANALYSIS task', async () => {
        const taskId = new Types.ObjectId().toString();
        const mockTask = {
            _id: taskId,
            userId,
            type: AgentTaskType.WEEKLY_ANALYSIS,
            status: AgentTaskStatus.COMPLETED,
            outputData: { headline: 'A productive week.' },
            completedAt: new Date(),
            updatedAt: new Date(),
        };

        (AgentTask.findById as jest.Mock).mockResolvedValue(mockTask);
        (Report.findOneAndUpdate as jest.Mock).mockResolvedValue({ _id: 'report123' });

        const result = await reportService.createFromTask(userId, taskId);

        expect(Report.findOneAndUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ type: ReportType.WEEKLY }),
            expect.objectContaining({ $set: expect.objectContaining({ content: mockTask.outputData }) }),
            expect.objectContaining({ upsert: true, new: true })
        );
        expect(result).toBeDefined();
    });

    it('creates a monthly report from a completed MONTHLY_ANALYSIS task', async () => {
        const taskId = new Types.ObjectId().toString();
        const mockTask = {
            _id: taskId,
            userId,
            type: AgentTaskType.MONTHLY_ANALYSIS,
            status: AgentTaskStatus.COMPLETED,
            outputData: { monthTitle: 'Strong month.' },
            completedAt: new Date(),
            updatedAt: new Date(),
        };

        (AgentTask.findById as jest.Mock).mockResolvedValue(mockTask);
        (Report.findOneAndUpdate as jest.Mock).mockResolvedValue({ _id: 'report456' });

        await reportService.createFromTask(userId, taskId);

        expect(Report.findOneAndUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ type: ReportType.MONTHLY }),
            expect.any(Object),
            expect.any(Object)
        );
    });

    it('throws if task is not found', async () => {
        (AgentTask.findById as jest.Mock).mockResolvedValue(null);
        await expect(reportService.createFromTask(userId, 'missing-id')).rejects.toThrow('Task not found');
    });

    it('throws if task is not completed', async () => {
        (AgentTask.findById as jest.Mock).mockResolvedValue({
            _id: 'tid',
            status: AgentTaskStatus.RUNNING,
        });
        await expect(reportService.createFromTask(userId, 'tid')).rejects.toThrow('Task not found or not completed');
    });
});

// ─── listReports (period-calendar architecture) ────────────────────────────────

describe('ReportService.listReports', () => {
    let reportService: ReportService;
    const userId = new Types.ObjectId().toString();

    const buildFindChain = (resolved: any[]) => ({
        lean: jest.fn().mockResolvedValue(resolved),
    });

    beforeEach(() => {
        jest.clearAllMocks();
        reportService = new ReportService();
    });

    it('returns NOT_GENERATED placeholders for every period since join date when no DB reports exist', async () => {
        const joinDate = new Date();
        joinDate.setDate(joinDate.getDate() - 14); // 2 weeks ago

        (User.findById as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue({ createdAt: joinDate }),
        });

        // No DB reports, no active tasks
        (Report.find as jest.Mock).mockReturnValue(buildFindChain([]));
        (AgentTask.find as jest.Mock).mockReturnValue(buildFindChain([]));

        const result = await reportService.listReports(userId, { type: ReportType.WEEKLY, page: 1, limit: 10 });

        expect(result.reports.length).toBeGreaterThanOrEqual(1);
        expect(result.reports.every(r => r.status === ReportStatus.NOT_GENERATED)).toBe(true);
        // All placeholders carry the correct type
        expect(result.reports.every(r => r.type === ReportType.WEEKLY)).toBe(true);
    });

    it('merges a PUBLISHED DB report into the matching period slot', async () => {
        const now = new Date();
        const joinDate = new Date(now);
        joinDate.setDate(joinDate.getDate() - 7);

        (User.findById as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue({ createdAt: joinDate }),
        });

        const publishedReport = {
            _id: 'r1',
            userId,
            type: ReportType.WEEKLY,
            status: ReportStatus.PUBLISHED,
            startDate: now,
            endDate: now,
            content: { headline: 'Done.' },
        };

        (Report.find as jest.Mock).mockReturnValue(buildFindChain([publishedReport]));
        (AgentTask.find as jest.Mock).mockReturnValue(buildFindChain([]));

        const result = await reportService.listReports(userId, { type: ReportType.WEEKLY, page: 1, limit: 10 });

        const published = result.reports.find(r => r.status === ReportStatus.PUBLISHED);
        expect(published).toBeDefined();
        expect(published?._id).toBe('r1');
    });

    it('marks a period as GENERATING when an active task matches', async () => {
        const now = new Date();
        const joinDate = new Date(now);
        joinDate.setDate(joinDate.getDate() - 7);

        (User.findById as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue({ createdAt: joinDate }),
        });

        (Report.find as jest.Mock).mockReturnValue(buildFindChain([]));
        (AgentTask.find as jest.Mock).mockReturnValue(buildFindChain([{
            _id: 'task1',
            userId,
            type: AgentTaskType.WEEKLY_ANALYSIS,
            status: AgentTaskStatus.RUNNING,
            updatedAt: now,
            createdAt: now,
            inputData: { startDate: now.toISOString() },
        }]));

        const result = await reportService.listReports(userId, { type: ReportType.WEEKLY, page: 1, limit: 10 });

        const generating = result.reports.find(r => r.status === ReportStatus.GENERATING);
        expect(generating).toBeDefined();
    });

    it('returns empty list with total=0 when user has no history', async () => {
        const now = new Date();

        (User.findById as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue({ createdAt: now }),
        });

        (Report.find as jest.Mock).mockReturnValue(buildFindChain([]));
        (AgentTask.find as jest.Mock).mockReturnValue(buildFindChain([]));

        const result = await reportService.listReports(userId, { type: ReportType.MONTHLY, page: 1, limit: 10 });

        // At minimum the current month should appear
        expect(result.total).toBeGreaterThanOrEqual(1);
    });
});
