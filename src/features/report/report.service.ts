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
import { IReport, ReportSearchRequest, ReportStatus, ReportType } from './report.types';
import { REPORT_CONSTANTS } from './report.constants';

export class ReportService implements IReportService {

    // Creates a report from a completed agent task
    async createFromTask(userId: string | Types.ObjectId, taskId: string): Promise<IReport> {
        const task = await AgentTask.findById(taskId);
        if (!task || task.status !== AgentTaskStatus.COMPLETED) {
            throw ApiError.badRequest('Task not found or not completed');
        }

        const { type, startDate, endDate } = this.getPeriodFromTask(task);

        logger.info(`Creating ${type} report from task`, { type, startDate, endDate, userId, taskId });
        const report = await this.upsertReport({
            userId: new Types.ObjectId(userId),
            type,
            startDate,
            endDate,
            content: task.outputData?.result || task.outputData,
            taskId: task._id as Types.ObjectId
        });

        // Broadcast realtime update
        socketService.emitToUser(userId, SocketEvents.REPORT_UPDATED, report);

        // Fire email non-blocking
        // TODO: uncomment it when required
        // this.sendNotification(report).catch(err =>
        //     logger.error(`[ReportService] Email delivery failed for user ${userId}`, err)
        // );

        return report;
    }

    private getPeriodFromTask(task: any): { type: ReportType, startDate: Date, endDate: Date } {
        let type: ReportType;
        let startDate: Date;
        let endDate: Date;

        // Determine period
        // If task input has explicit dates, use them. Otherwise, apply lookback shift for cron tasks.
        const baseDate = new Date(task.completedAt || task.updatedAt || task.createdAt);
        if (!task.inputData?.startDate) {
            baseDate.setHours(baseDate.getHours() - REPORT_CONSTANTS.CRON_LOOKBACK_HOURS);
        }

        const referenceDate = task.inputData?.startDate ? new Date(task.inputData.startDate) : baseDate;

        if (task.type === AgentTaskType.WEEKLY_ANALYSIS) {
            type = ReportType.WEEKLY;
            startDate = startOfWeek(referenceDate, { weekStartsOn: 1 });
            endDate = endOfWeek(referenceDate, { weekStartsOn: 1 });
        } else if (task.type === AgentTaskType.MONTHLY_ANALYSIS) {
            type = ReportType.MONTHLY;
            startDate = startOfMonth(referenceDate);
            endDate = endOfMonth(referenceDate);
        } else {
            throw ApiError.badRequest('Invalid task type for report generation');
        }

        return { type, startDate, endDate };
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
            if (error.code === 11000) {
                logger.warn(`Duplicate report race condition for user ${userId}. Retrying.`);
                return Report.findOneAndUpdate(
                    { userId, type, startDate, endDate },
                    update,
                    { new: true }
                ).lean() as unknown as IReport;
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
            // Check if it's a virtual report from an active task
            const task = await AgentTask.findOne({ 
                _id: reportId, 
                userId: new Types.ObjectId(userId),
                status: { $in: [AgentTaskStatus.PENDING, AgentTaskStatus.RUNNING] }
            }).lean();

            if (task) {
                const { type, startDate, endDate } = this.getPeriodFromTask(task);
                return {
                    _id: task._id.toString(),
                    userId: task.userId,
                    type,
                    status: ReportStatus.GENERATING,
                    startDate,
                    endDate,
                    content: {},
                    metadata: { generatedByTaskId: task._id },
                    createdAt: task.createdAt,
                    updatedAt: task.updatedAt
                } as unknown as IReport;
            }

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

    // List reports with pagination and filtering, filling gaps with NOT_GENERATED placeholders
    async listReports(userId: string, searchParams?: ReportSearchRequest): Promise<{ reports: IReport[]; total: number; page: number; limit: number }> {
        const { type, page = REPORT_CONSTANTS.DEFAULT_PAGE, limit = REPORT_CONSTANTS.DEFAULT_LIMIT } = searchParams || {};
        
        // 1. Get user's join date to determine the beginning of time
        const user = await User.findById(userId).select('createdAt').lean();
        if (!user) throw ApiError.notFound('User not found');
        
        const joinDate = user.createdAt;
        const now = new Date();
        
        // 2. Generate all potential periods from today back to joinDate
        const periods: { startDate: Date; endDate: Date }[] = [];
        const current = type === ReportType.MONTHLY 
            ? startOfMonth(now) 
            : startOfWeek(now, { weekStartsOn: 1 });
            
        const minDate = type === ReportType.MONTHLY
            ? startOfMonth(joinDate)
            : startOfWeek(joinDate, { weekStartsOn: 1 });

        while (current >= minDate) {
            const startDate = new Date(current);
            const endDate = type === ReportType.MONTHLY 
                ? endOfMonth(current) 
                : endOfWeek(current, { weekStartsOn: 1 });
            
            periods.push({ startDate, endDate });
            
            // Move back
            if (type === ReportType.MONTHLY) {
                current.setMonth(current.getMonth() - 1);
            } else {
                current.setDate(current.getDate() - 7);
            }
        }

        // 3. Paginate the periods
        const total = periods.length;
        const skip = (page - 1) * limit;
        const paginatedPeriods = periods.slice(skip, skip + limit);

        if (paginatedPeriods.length === 0) {
            return { reports: [], total, page, limit };
        }

        // 4. Fetch existing reports and active tasks for these periods
        const periodRange = {
            $or: paginatedPeriods.map(p => ({
                startDate: { $gte: p.startDate, $lte: p.endDate }
            }))
        };

        const [dbReports, activeTasks] = await Promise.all([
            Report.find({ userId: new Types.ObjectId(userId), type, ...periodRange }).lean(),
            AgentTask.find({
                userId: new Types.ObjectId(userId),
                type: type === ReportType.WEEKLY ? AgentTaskType.WEEKLY_ANALYSIS : AgentTaskType.MONTHLY_ANALYSIS,
                status: { $in: [AgentTaskStatus.PENDING, AgentTaskStatus.RUNNING] }
            }).lean()
        ]);

        // 5. Merge existing data into the paginated periods
        const finalReports = paginatedPeriods.map(period => {
            // Check for existing report that falls within this period
            const existingReport = dbReports.find(r => {
                const reportStart = new Date(r.startDate);
                return reportStart >= period.startDate && reportStart <= period.endDate;
            });

            if (existingReport) {
                // Check if there's an active task for this same period (regeneration)
                const isRegenerating = activeTasks.some(task => {
                    try {
                        const { startDate: sDate } = this.getPeriodFromTask(task);
                        return sDate >= period.startDate && sDate <= period.endDate;
                    } catch (e) { return false; }
                });

                if (isRegenerating) {
                    return { ...existingReport, status: ReportStatus.GENERATING } as unknown as IReport;
                }
                return existingReport as unknown as IReport;
            }

            // Check for active task (new generation)
            const activeTask = activeTasks.find(task => {
                try {
                    const { startDate: sDate } = this.getPeriodFromTask(task);
                    return sDate >= period.startDate && sDate <= period.endDate;
                } catch (e) { return false; }
            });

            if (activeTask) {
                return {
                    _id: activeTask._id.toString(),
                    userId: activeTask.userId,
                    type,
                    status: ReportStatus.GENERATING,
                    startDate: period.startDate,
                    endDate: period.endDate,
                    content: {},
                    metadata: { generatedByTaskId: activeTask._id },
                    createdAt: activeTask.createdAt,
                    updatedAt: activeTask.updatedAt
                } as unknown as IReport;
            }

            // Fallback: Not Generated Placeholder
            return {
                _id: `not-gen-${type}-${period.startDate.getTime()}`,
                userId: new Types.ObjectId(userId),
                type,
                status: ReportStatus.NOT_GENERATED,
                startDate: period.startDate,
                endDate: period.endDate,
                content: {},
                createdAt: period.startDate,
                updatedAt: period.startDate
            } as unknown as IReport;
        });

        return { reports: finalReports, total, page, limit };
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
