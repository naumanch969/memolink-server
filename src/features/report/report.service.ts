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
import { IReport, ReportEligibility, ReportSearchRequest, ReportStatus, ReportType } from './report.types';
import { REPORT_CONSTANTS } from './report.constants';
import { USER_ROLES } from '../../shared/constants';
import Report from './report.model';
import { Entry } from '../entry/entry.model';
import { EntryStatus } from '../entry/entry.types';

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
        // Determine period
        // If task input has explicit dates, use them. Otherwise, apply lookback shift for cron tasks.
        const baseDate = new Date(task.completedAt || task.updatedAt || task.createdAt);
        if (!task.inputData?.startDate) {
            baseDate.setHours(baseDate.getHours() - REPORT_CONSTANTS.CRON_LOOKBACK_HOURS);
        }

        const referenceDate = task.inputData?.startDate ? new Date(task.inputData.startDate) : baseDate;
        const type = task.type === AgentTaskType.WEEKLY_ANALYSIS ? ReportType.WEEKLY : ReportType.MONTHLY;

        const { start, end } = DateUtil.getPeriod(type as any, referenceDate);

        return { type, startDate: start, endDate: end };
    }

    private async upsertReport(params: { userId: Types.ObjectId; type: ReportType; startDate: Date; endDate: Date; content: any; taskId: Types.ObjectId; }): Promise<IReport> {
        const { userId, type, startDate, endDate, content, taskId } = params;

        const update = {
            $set: {
                content,
                'metadata.generatedByTaskId': taskId
            }
        };

        return await Report.findOneAndUpdate(
            { userId, type, startDate, endDate },
            update,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    }

    // Manually triggers a report generation task
    async generateOnDemand(userId: string, type: ReportType, startDate?: string, endDate?: string): Promise<{ taskId: string }> {
        const user = await User.findById(userId).select('role').lean();
        if (!user) throw ApiError.notFound('User not found');

        const isPro = user.role === USER_ROLES.ADMIN || user.role === USER_ROLES.PRO;

        // 1. Resolve period dates
        const referenceDate = startDate ? new Date(startDate) : new Date();
        const { start: sDate, end: eDate } = DateUtil.getPeriod(type as any, referenceDate);

        // 2. Check if report already exists (Regeneration Check)
        const existingReport = await Report.findOne({
            userId,
            type,
            startDate: sDate,
            endDate: eDate,
            status: ReportStatus.PUBLISHED
        });

        if (existingReport && !isPro) {
            throw ApiError.forbidden('Regeneration is a Pro-only feature. Upgrade to unlock multiple syntheses.');
        }

        // 3. Signal Threshold Check
        const eligibility = await this.checkEligibility(userId, type, sDate, eDate);
        if (!eligibility.isEligible) {
            throw ApiError.badRequest('Low data signal. Add more entries or write more detail to unlock this report.', JSON.stringify(eligibility));
        }

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
            startDate: sDate.toISOString(),
            endDate: eDate.toISOString()
        });
        return { taskId: task._id.toString() };
    }

    async checkEligibility(userId: string | Types.ObjectId, type: ReportType, startDate: Date, endDate: Date): Promise<ReportEligibility> {
        const entries = await Entry.find({
            userId: new Types.ObjectId(userId),
            date: { $gte: startDate, $lte: endDate },
            status: EntryStatus.COMPLETED
        }).select('content date').lean();

        const entryCount = entries.length;
        const wordCount = entries.reduce((acc, entry) => {
            return acc + (entry.content?.split(/\s+/).filter(word => word.length > 0).length || 0);
        }, 0);

        const coveredDates = Array.from(new Set(entries.map(e => format(new Date(e.date), 'yyyy-MM-dd'))));
        const uniqueDays = coveredDates.length;

        const thresholds = REPORT_CONSTANTS.THRESHOLDS[type as keyof typeof REPORT_CONSTANTS.THRESHOLDS];

        const isEligible =
            entryCount >= thresholds.MIN_ENTRIES &&
            wordCount >= thresholds.MIN_WORDS &&
            uniqueDays >= thresholds.MIN_DAYS;

        return {
            isEligible,
            message: isEligible ? 'Success' : 'Low data signal. Add more entries or write more detail to unlock this report.',
            metrics: {
                entryCount,
                wordCount,
                uniqueDays,
                coveredDates
            },
            thresholds: {
                minEntries: thresholds.MIN_ENTRIES,
                minWords: thresholds.MIN_WORDS,
                minDays: thresholds.MIN_DAYS
            }
        };
    }

    // Get a specific report by ID
    async getReportById(reportId: string, userId: string): Promise<IReport> {
        // Handle NOT_GENERATED placeholders
        if (reportId.startsWith('not-gen-')) {
            const parts = reportId.split('-');
            const type = parts[2] as ReportType;
            const timestamp = parseInt(parts[3], 10);
            const startDate = new Date(timestamp);

            return {
                _id: reportId,
                userId: new Types.ObjectId(userId),
                type,
                status: ReportStatus.NOT_GENERATED,
                startDate,
                endDate: type === ReportType.MONTHLY ? endOfMonth(startDate) : endOfWeek(startDate, { weekStartsOn: 1 }),
                content: {},
                createdAt: startDate,
                updatedAt: startDate
            } as unknown as IReport;
        }

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

        const frontendUrl = config.FRONTEND_URL ?? 'https://app.brinn.app';
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

    /**
     * Staggers the creation of agent tasks across the user base to prevent load spikes.
     * Processes users in batches with a delay between each batch.
     */
    async triggerStaggeredReports(taskType: AgentTaskType): Promise<void> {
        try {
            const batchSize = 20;
            const delayBetweenBatchesMs = 5000; // 5 seconds

            let lastId = null;
            let processedCount = 0;
            let enqueuedCount = 0;

            const reportType = taskType === AgentTaskType.WEEKLY_ANALYSIS ? ReportType.WEEKLY : ReportType.MONTHLY;

            // Match lookback logic to ensure we trigger for the correct period
            const referenceDate = new Date();
            referenceDate.setHours(referenceDate.getHours() - REPORT_CONSTANTS.CRON_LOOKBACK_HOURS);

            const { start, end } = DateUtil.getPeriod(reportType as any, referenceDate);

            logger.info(`Cron [${taskType}]: Starting trigger for period ${start.toISOString()} to ${end.toISOString()}`);

            while (true) {
                const query: any = {};
                if (lastId) query._id = { $gt: lastId };

                const users = await User.find(query)
                    .sort({ _id: 1 })
                    .limit(batchSize)
                    .select('_id')
                    .lean();

                if (users.length === 0) break;

                for (const user of users) {
                    const eligibility = await this.checkEligibility(user._id, reportType, start, end);

                    if (eligibility.isEligible) {
                        await agentService.createTask(user._id.toString(), taskType, {
                            startDate: start,
                            endDate: end
                        });
                        enqueuedCount++;
                    }
                }

                processedCount += users.length;
                lastId = users[users.length - 1]._id;

                logger.info(`Cron [${taskType}]: Processed ${users.length} users (Enqueued: ${enqueuedCount}/${processedCount})`);

                if (users.length === batchSize) {
                    await new Promise(resolve => setTimeout(resolve, delayBetweenBatchesMs));
                } else {
                    break;
                }
            }

            logger.info(`Cron [${taskType}]: Completed. Users scanned: ${processedCount}, Tasks enqueued: ${enqueuedCount}`);
        } catch (error) {
            logger.error(`Staggered trigger failed for ${taskType}:`, error);
        }
    }
}

export const reportService = new ReportService();
export default reportService;
