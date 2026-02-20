import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns';
import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { ApiError } from '../../core/errors/api.error';
import { AgentTask } from '../agent/agent.model';
import { agentService } from '../agent/agent.service';
import { AgentTaskType } from '../agent/agent.types';
import { IReport, ReportSearchRequest, ReportType } from './report.interfaces';
import { Report } from './report.model';

export class ReportService {
    /**
     * Creates a report from a completed agent task
     */
    async createFromTask(userId: string, taskId: string): Promise<IReport> {
        const task = await AgentTask.findById(taskId);
        if (!task || task.status !== 'COMPLETED') {
            throw ApiError.badRequest('Task not found or not completed');
        }

        let type: ReportType;
        let startDate: Date;
        let endDate: Date;

        // Use a 4-hour lookback to handle late-night cron jobs (e.g. 1 AM triggers for previous period)
        const completionDate = new Date(task.completedAt || task.updatedAt);
        const standardizedDate = new Date(completionDate);
        standardizedDate.setHours(standardizedDate.getHours() - 4);

        if (task.type === AgentTaskType.WEEKLY_ANALYSIS) {
            type = ReportType.WEEKLY;
            // Standardize to Monday-Sunday week for consistency between manual and cron triggers
            startDate = startOfWeek(standardizedDate, { weekStartsOn: 1 });
            endDate = endOfWeek(standardizedDate, { weekStartsOn: 1 });
        } else if (task.type === AgentTaskType.MONTHLY_ANALYSIS) {
            type = ReportType.MONTHLY;
            startDate = startOfMonth(standardizedDate);
            endDate = endOfMonth(standardizedDate);
        } else {
            throw ApiError.badRequest('Invalid task type for report generation');
        }

        // Check if report already exists for this exact period to avoid duplicates
        // We use standardized window to match
        try {
            const report = await Report.findOneAndUpdate(
                {
                    userId: new Types.ObjectId(userId),
                    type,
                    startDate,
                    endDate
                },
                {
                    $set: {
                        content: task.outputData,
                        'metadata.generatedByTaskId': task._id as Types.ObjectId
                    }
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                }
            );

            logger.info(`Report [${type}] ${report.isNew ? 'created' : 'updated'} for user ${userId} for period ${startDate.toISOString()}`);
            return report;
        } catch (error: any) {
            // Handle race condition where two tasks try to upsert at the exact same time
            if (error.code === 11000) {
                logger.warn(`Duplicate report race condition detected for user ${userId}. Retrying update.`);
                const report = await Report.findOneAndUpdate(
                    {
                        userId: new Types.ObjectId(userId),
                        type,
                        startDate,
                        endDate
                    },
                    {
                        $set: {
                            content: task.outputData,
                            'metadata.generatedByTaskId': task._id as Types.ObjectId
                        }
                    },
                    { new: true }
                );
                return report!;
            }
            throw error;
        }
    }

    /**
     * Manually triggers a report generation task
     */
    async generateOnDemand(userId: string, type: ReportType): Promise<{ taskId: string }> {
        const { AgentTask } = await import('../agent/agent.model');
        const { AgentTaskStatus, AgentTaskType } = await import('../agent/agent.types');

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

        const task = await agentService.createTask(userId, taskType, { onDemand: true });
        return { taskId: task._id.toString() };
    }

    /**
     * Get a specific report by ID
     */
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

    /**
     * List reports with pagination and filtering
     */
    async listReports(userId: string, searchParams: ReportSearchRequest = {}): Promise<{
        reports: IReport[];
        total: number;
        page: number;
        limit: number;
    }> {
        const { type, startDate, endDate, page = 1, limit = 10 } = searchParams;
        const query: any = { userId: new Types.ObjectId(userId) };

        if (type) query.type = type;
        if (startDate || endDate) {
            query.startDate = {};
            if (startDate) query.startDate.$gte = new Date(startDate);
            if (endDate) query.startDate.$lte = new Date(endDate);
        }

        const [reports, total] = await Promise.all([
            Report.find(query)
                .sort({ startDate: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Report.countDocuments(query)
        ]);

        return {
            reports: reports as IReport[],
            total,
            page,
            limit
        };
    }

    /**
     * Get the latest reports (1 weekly, 1 monthly)
     */
    async getLatestReports(userId: string): Promise<{ weekly?: IReport, monthly?: IReport }> {
        const [weekly, monthly] = await Promise.all([
            Report.findOne({ userId: new Types.ObjectId(userId), type: ReportType.WEEKLY }).sort({ startDate: -1 }).lean(),
            Report.findOne({ userId: new Types.ObjectId(userId), type: ReportType.MONTHLY }).sort({ startDate: -1 }).lean(),
        ]);

        return {
            weekly: weekly as IReport,
            monthly: monthly as IReport
        };
    }
}

export const reportService = new ReportService();
export default reportService;
