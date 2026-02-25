import { Types } from 'mongoose';
import { IReport, ReportSearchRequest, ReportType } from "./report.types";

export interface IReportService {
    createFromTask(userId: string | Types.ObjectId, taskId: string): Promise<IReport>;
    generateOnDemand(userId: string, type: ReportType): Promise<{ taskId: string }>;
    getReportById(reportId: string, userId: string): Promise<IReport>;
    listReports(userId: string, searchParams?: ReportSearchRequest): Promise<{ reports: IReport[]; total: number; page: number; limit: number }>;
}

