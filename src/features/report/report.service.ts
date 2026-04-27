import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import { DateUtil } from '../../shared/utils/date.utils';
import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { ApiError } from '../../core/errors/api.error';
import { socketService } from '../../core/socket/socket.service';
import { SocketEvents } from '../../core/socket/socket.types';
import { AgentTask } from '../agent/agent.model';
import { AgentTaskStatus, AgentTaskType } from '../agent/agent.types';
import { agentService } from '../agent/services/agent.service';
import { config } from '../../config/env';
import { emailService } from '../email/email.service';
import { User } from '../auth/auth.model';
import { IReportService } from "./report.interfaces";
import Report from './report.model';
import { IReport, ReportSearchRequest, ReportType } from './report.types';
import { REPORT_CONSTANTS } from './report.constants';

export class ReportService implements IReportService {

    // Creates a report from a completed agent task
    async createFromTask(userId: string | Types.ObjectId, taskId: string): Promise<IReport> {
        const task = await AgentTask.findById(taskId);
        if (!task || task.status !== AgentTaskStatus.COMPLETED) {
            throw ApiError.badRequest('Task not found or not completed');
        }

        let type: ReportType;
        let startDate: Date;
        let endDate: Date;

        // Determine period
        const standardizedDate = new Date(task.completedAt || task.updatedAt);
        standardizedDate.setHours(standardizedDate.getHours() - REPORT_CONSTANTS.CRON_LOOKBACK_HOURS);

        if (task.type === AgentTaskType.WEEKLY_ANALYSIS) {
            type = ReportType.WEEKLY;
            startDate = startOfWeek(standardizedDate, { weekStartsOn: 1 });
            endDate = endOfWeek(standardizedDate, { weekStartsOn: 1 });
        } else if (task.type === AgentTaskType.MONTHLY_ANALYSIS) {
            type = ReportType.MONTHLY;
            startDate = startOfMonth(standardizedDate);
            endDate = endOfMonth(standardizedDate);
        } else {
            throw ApiError.badRequest('Invalid task type for report generation');
        }

        const report = await this.upsertReport({
            userId: new Types.ObjectId(userId),
            type,
            startDate,
            endDate,
            content: task.outputData,
            taskId: task._id as Types.ObjectId
        });

        // Broadcast realtime update
        socketService.emitToUser(userId, SocketEvents.REPORT_UPDATED, report);

        // Fire email non-blocking
        this.sendNotification(report).catch(err =>
            logger.error(`[ReportService] Email delivery failed for user ${userId}`, err)
        );

        return report;
    }

    private async upsertReport(params: { userId: Types.ObjectId; type: ReportType; startDate: Date; endDate: Date; content: any; taskId: Types.ObjectId; }): Promise<IReport> {
        const { userId, type, startDate, endDate, content, taskId } = params;

        const update = {
            $set: {
                content,
                'metadata.generatedByTaskId': taskId
            }
        };

        try {
            return await Report.findOneAndUpdate(
                { userId, type, startDate, endDate },
                update,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        } catch (error: any) {
            // Handle race condition for unique index { userId, type, startDate, endDate }
            if (error.code === 11000) {
                logger.warn(`Duplicate report race condition detected for user ${userId}. Retrying update.`);
                return await Report.findOneAndUpdate(
                    { userId, type, startDate, endDate },
                    update,
                    { new: true }
                ) as IReport;
            }
            throw error;
        }
    }

    // Manually triggers a report generation task (Admin Only)
    async generateOnDemand(userId: string, type: ReportType, startDate?: string, endDate?: string): Promise<{ taskId: string }> {

        const taskType = type === ReportType.WEEKLY
            ? AgentTaskType.WEEKLY_ANALYSIS
            : AgentTaskType.MONTHLY_ANALYSIS;

        // Check for existing pending or running task to prevent duplicates
        const existingTask = await AgentTask.findOne({
            userId,
            type: taskType,
            status: { $in: [AgentTaskStatus.PENDING, AgentTaskStatus.RUNNING] }
        });

        if (existingTask) {
            logger.info(`Generation task already in progress for user ${userId}, type ${type}`);
            return { taskId: existingTask._id.toString() };
        }

        const task = await agentService.createTask(userId, taskType, {
            onDemand: true,
            startDate,
            endDate
        });
        return { taskId: task._id.toString() };
    }

    // Get a specific report by ID
    async getReportById(reportId: string, userId: string): Promise<IReport> {
        const report = await Report.findOne({ _id: reportId, userId: new Types.ObjectId(userId) });
        if (!report) {
            throw ApiError.notFound('Report not found');
        }

        // Update view count
        report.metadata = {
            ...report.metadata,
            viewCount: (report.metadata?.viewCount || 0) + 1,
            lastViewedAt: new Date()
        };
        await report.save();

        return report;
    }

    // List reports with pagination and filtering
    async listReports(userId: string, searchParams?: ReportSearchRequest): Promise<{ reports: IReport[]; total: number; page: number; limit: number }> {
        const { type, startDate, endDate, page = REPORT_CONSTANTS.DEFAULT_PAGE, limit = REPORT_CONSTANTS.DEFAULT_LIMIT } = searchParams || {};
        const skip = (page - 1) * limit;

        const query: any = { userId: new Types.ObjectId(userId) };
        if (type) query.type = type;
        if (startDate && endDate) {
            query.startDate = { $gte: new Date(startDate) };
            query.endDate = { $lte: new Date(endDate) };
        }

        const [reports, total] = await Promise.all([
            Report.find(query).sort({ startDate: -1 }).skip(skip).limit(limit).lean(),
            Report.countDocuments(query)
        ]);

        return { reports: reports as IReport[], total, page, limit };
    }

    private async sendNotification(report: IReport): Promise<void> {
        const userId = report.userId.toString();
        const user = await User.findById(userId).select('email preferences').lean();

        if (!user?.email || user.preferences?.notifications === false) return;

        const frontendUrl = config.FRONTEND_URL ?? 'https://app.brinn.ai';
        const period = DateUtil.formatPeriod(report.startDate, report.endDate);

        if (report.type === ReportType.WEEKLY) {
            await emailService.sendWeeklyReportEmail(user.email, period, report.content, frontendUrl, userId);
        } else {
            await emailService.sendMonthlyReportEmail(user.email, period, report.content, frontendUrl, userId);
        }
    }

    async getLatestReportBefore(userId: string | Types.ObjectId, type: ReportType, date: Date): Promise<IReport | null> {
        return await Report.findOne({ userId, type, startDate: { $lt: date } })
            .sort({ startDate: -1 })
            .select('content startDate endDate')
            .lean();
    }
}

export const reportService = new ReportService();
export default reportService;
