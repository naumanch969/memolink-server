import { ActivitySyncBatch, IWebActivity } from "./web-activity.types";

export interface IWebActivityService {
    syncActivity(userId: string, batch: ActivitySyncBatch): Promise<IWebActivity | null>;
    getStatsByDate(userId: string, date?: string, timezone?: string): Promise<IWebActivity | null>;
    getTodayStats(userId: string, date?: string): Promise<IWebActivity | null>;
    getDefinitions(userId: string): Promise<any>;
    upsertDomainLimit(userId: string, data: any): Promise<any>;
    removeDomainLimit(userId: string, domain: string): Promise<any>;
    checkLimits(userId: string, date?: string): Promise<any>;
    getActivityRange(userId: string, fromDate: string, toDate: string): Promise<IWebActivity[]>;
    getWeeklySummary(userId: string, endDate: string): Promise<any>;
    getMonthlySummary(userId: string, year: number, month: number): Promise<any>;
    updateDefinitions(userId: string, data: any): Promise<any>;
    deleteUserData(userId: string): Promise<number>;
}

