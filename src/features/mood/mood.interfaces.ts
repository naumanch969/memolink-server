import { Document, Types } from 'mongoose';

export interface IMood {
    userId: Types.ObjectId;
    date: Date;
    score: number; // 1-5
    note?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IMoodDocument extends IMood, Document { }

export interface CreateMoodRequest {
    date: Date | string;
    score: number;
    note?: string;
}

export interface MoodFilter {
    dateFrom?: string;
    dateTo?: string;
}

export interface IMoodService {
    upsertMood(userId: string | Types.ObjectId, data: CreateMoodRequest): Promise<IMoodDocument>;
    getMoods(userId: string | Types.ObjectId, filter?: MoodFilter): Promise<IMoodDocument[]>;
    deleteMood(userId: string | Types.ObjectId, date: Date): Promise<IMoodDocument | null>;
    recalculateDailyMoodFromEntries(userId: string | Types.ObjectId, date: Date): Promise<void>;
}

