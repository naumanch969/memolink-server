import { Types } from "mongoose";
import { BaseEntity } from "../../shared/types";

export interface IWebActivity extends BaseEntity {
    userId: Types.ObjectId;
    date: string;
    totalSeconds: number;
    productiveSeconds: number;
    distractingSeconds: number;
    domainMap: Record<string, number>;
    summaryCreated?: boolean;
}

export interface WebActivityEvent {
    domain: string;
    url: string;
    title: string;
    startTime: number; // timestamp in ms
    endTime: number;   // timestamp in ms
    duration: number;  // duration in seconds
}

export interface ActivitySyncBatch {
    syncId: string;
    date: string;
    totalSeconds: number;
    productiveSeconds: number;
    distractingSeconds: number;
    domainMap: Record<string, number>;
    events?: WebActivityEvent[];
}

export interface WebActivityDomainLimit {
    domain: string;
    dailyLimitMinutes: number;
    action: 'nudge' | 'block';
    enabled?: boolean;
}

export interface WebActivityDefinitionsDTO {
    productiveDomains?: string[];
    distractingDomains?: string[];
    domainLimits?: WebActivityDomainLimit[];
}

export interface ActivityLimitCheckResult {
    limits: Array<{
        domain: string;
        dailyLimitMinutes: number;
        usedMinutes: number;
        action: 'nudge' | 'block';
        exceeded: boolean;
        percentUsed: number;
    }>;
}

export interface ActivitySummaryResult {
    activities: IWebActivity[];
    totalTime: number;
    avgProductivePercent: number;
    topDomains: Array<{ domain: string; seconds: number }>;
}

export interface MonthlyActivitySummaryResult extends ActivitySummaryResult {
    mostProductiveDay: string | null;
    leastProductiveDay: string | null;
}

export interface BehavioralCluster {
    dayOfWeek: number;
    hourOfDay: number;
    category: string;
    sessionCount: number;
    totalTimeMins: number;
    avgFlowStateMins: number;
    totalContextSwitches: number;
}
