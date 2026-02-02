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
