import { Types } from 'mongoose';
import { BaseEntity } from '../../shared/types';

export interface IWebActivity extends BaseEntity {
    userId: Types.ObjectId;
    date: string; // YYYY-MM-DD
    totalSeconds: number;
    productiveSeconds: number;
    distractingSeconds: number;
    domainMap: Record<string, number>; // domain -> seconds
    summaryCreated?: boolean; // Whether the AI summary has been generated for this day
}

export interface ActivitySyncBatch {
    syncId: string; // Client-generated UUID for idempotency
    date: string;
    totalSeconds: number;
    productiveSeconds: number;
    distractingSeconds: number;
    domainMap: Record<string, number>;
}
