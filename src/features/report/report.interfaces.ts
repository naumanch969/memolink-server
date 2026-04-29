import { Types } from "mongoose";
import { IReport, ReportContext, ReportEligibility, ReportSearchRequest, ReportType } from "./report.types";

export interface IReportService {
    createFromTask(userId: string | Types.ObjectId, taskId: string): Promise<IReport>;
    generateOnDemand(userId: string, type: ReportType, startDate?: string, endDate?: string): Promise<{ taskId: string }>;
    getReportById(reportId: string, userId: string): Promise<IReport>;
    listReports(userId: string, searchParams?: ReportSearchRequest): Promise<{ reports: IReport[]; total: number; page: number; limit: number }>;
    checkEligibility(userId: string, type: ReportType, startDate: Date, endDate: Date): Promise<ReportEligibility>;
}

export interface IReportContextBuilder {
    build(userId: string | Types.ObjectId, start: Date, end: Date, type: ReportType): Promise<ReportContext>;
}

