import { Types } from 'mongoose';
import { BaseEntity } from '../../shared/types';

export enum ReportType {
    WEEKLY = 'WEEKLY',
    MONTHLY = 'MONTHLY',
}

export enum ReportStatus {
    DRAFT = 'DRAFT',
    PUBLISHED = 'PUBLISHED',
}

export interface IReport extends BaseEntity {
    userId: Types.ObjectId;
    type: ReportType;
    status: ReportStatus;
    startDate: Date;
    endDate: Date;
    content: any; // Flexible JSON from AI analysis
    metadata?: {
        viewCount?: number;
        lastViewedAt?: Date;
        generatedByTaskId?: Types.ObjectId;
    };
}

export interface CreateReportRequest {
    userId: string;
    type: ReportType;
    startDate: Date;
    endDate: Date;
    content: any;
    generatedByTaskId?: string;
}

export interface ReportSearchRequest {
    type?: ReportType;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}
