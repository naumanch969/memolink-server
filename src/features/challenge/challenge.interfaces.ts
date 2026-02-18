import { Document, Types } from 'mongoose';
import { BaseEntity } from '../../shared/types';

export enum ChallengeStatus {
    ACTIVE = 'active',
    COMPLETED = 'completed',
    FAILED = 'failed',
    ARCHIVED = 'archived'
}

export enum ChallengeType {
    BINARY = 'binary',   // Check off
    NUMERIC = 'numeric',  // Quantity
    SNAPSHOT = 'snapshot' // Notes/Journal
}

export interface IChallenge extends BaseEntity {
    userId: Types.ObjectId;
    goalId?: Types.ObjectId;
    title: string;
    description?: string;
    duration: 7 | 14 | 30;
    startDate: Date;
    endDate: Date;
    status: ChallengeStatus;
    type: ChallengeType;
    config: {
        targetValue?: number;
        unit?: string;
        failureThreshold?: number; // Max missed days before auto-fail
    };
    stats: {
        completionPercentage: number;
        currentStreak: number;
        totalCompletions: number;
        missedDays: number;
        lastLoggedDay?: number;
    };
    metadata?: Record<string, any>;
}

export interface IChallengeDocument extends IChallenge, Document {
    _id: Types.ObjectId;
}

export interface IChallengeLog extends BaseEntity {
    userId: Types.ObjectId;
    challengeId: Types.ObjectId;
    dayIndex: number; // 1 to 30
    date: Date; // Normalized date of the day
    status: 'completed' | 'missed' | 'skipped' | 'pending';
    value?: number | string;
    notes?: string;
    loggedAt?: Date;
}

export interface IChallengeLogDocument extends IChallengeLog, Document {
    _id: Types.ObjectId;
}

export interface CreateChallengeParams {
    userId?: string;
    goalId?: string;
    title: string;
    description?: string;
    duration: 7 | 14 | 30;
    type: ChallengeType;
    config?: {
        targetValue?: number;
        unit?: string;
        failureThreshold?: number;
    };
    reminderTime?: string; // HH:mm
}

export interface CreateChallengeLogParams {
    challengeId: string;
    dayIndex: number;
    status: 'completed' | 'missed' | 'skipped';
    value?: number | string;
    notes?: string;
    date?: string | Date; // Optional back-filling
}
