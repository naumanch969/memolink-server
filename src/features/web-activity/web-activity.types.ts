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

export interface ActivitySyncBatch {
    syncId: string;
    date: string;
    totalSeconds: number;
    productiveSeconds: number;
    distractingSeconds: number;
    domainMap: Record<string, number>;
}
