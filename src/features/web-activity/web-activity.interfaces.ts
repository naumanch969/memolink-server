import { IActivityDefinitions } from "./activity-definitions.model";
import { IPassiveSession } from "./passive-session.model";
import { ActivityLimitCheckResult, ActivitySummaryResult, ActivitySyncBatch, BehavioralCluster, IWebActivity, MonthlyActivitySummaryResult, WebActivityDefinitionsDTO, WebActivityDomainLimit } from "./web-activity.types";

export interface IWebActivityService {
    syncActivity(userId: string, batch: ActivitySyncBatch): Promise<IWebActivity | null>;
    getPassiveSummary(userId: string, date: string): Promise<Partial<any> | null>; // Using any for IEnrichedEntry to avoid massive cross-coupling, or can use an explicit unknown
    getSessionsByDate(userId: string, date: string): Promise<IPassiveSession[]>;
    getStatsByDate(userId: string, date?: string, timezone?: string): Promise<IWebActivity | null>;
    getTodayStats(userId: string, date?: string): Promise<IWebActivity | null>;
    getDefinitions(userId: string): Promise<IActivityDefinitions>;
    upsertDomainLimit(userId: string, data: WebActivityDomainLimit): Promise<IActivityDefinitions>;
    removeDomainLimit(userId: string, domain: string): Promise<IActivityDefinitions>;
    checkLimits(userId: string, date?: string): Promise<ActivityLimitCheckResult>;
    getActivityRange(userId: string, fromDate: string, toDate: string): Promise<IWebActivity[]>;
    getWeeklySummary(userId: string, endDate: string): Promise<ActivitySummaryResult>;
    getMonthlySummary(userId: string, year: number, month: number): Promise<MonthlyActivitySummaryResult>;
    getBehavioralClusters(userId: string, fromDate: string, toDate: string): Promise<BehavioralCluster[]>;
    updateDefinitions(userId: string, data: WebActivityDefinitionsDTO): Promise<IActivityDefinitions | null>;
    deleteUserData(userId: string): Promise<number>;
}
