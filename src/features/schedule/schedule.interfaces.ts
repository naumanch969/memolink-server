import { Document, Types } from 'mongoose';
import { BaseEntity } from '../../shared/types';

export enum ScheduleAction {
    SEND_PUSH_NOTIFICATION = 'SEND_PUSH_NOTIFICATION',
    EXECUTE_AI_AGENT = 'EXECUTE_AI_AGENT',
    TRIGGER_WEBHOOK = 'TRIGGER_WEBHOOK'
}

export enum ScheduleStatus {
    ACTIVE = 'active',
    PAUSED = 'paused',
    COMPLETED = 'completed'
}

export interface ISchedule extends BaseEntity {
    userId: Types.ObjectId;
    type: string; // 'challenge', 'habit', 'system'
    action: ScheduleAction;
    payload: Record<string, any>; // e.g., { challengeId, templateId, message }
    cronExpression?: string; // Optional: for recurring tasks
    nextRunAt: Date; // The timestamp for the next execution
    status: ScheduleStatus;
    referenceId?: Types.ObjectId; // e.g. ChallengeId
    referenceModel?: string; // 'Challenge'
    metadata?: Record<string, any>;
}

export interface IScheduleDocument extends ISchedule, Document {
    _id: Types.ObjectId;
}

export interface CreateScheduleParams {
    userId: string;
    type: string;
    action: ScheduleAction;
    payload: Record<string, any>;
    nextRunAt: Date | string;
    cronExpression?: string;
    referenceId?: string;
    referenceModel?: string;
    metadata?: Record<string, any>;
}

export interface UpdateScheduleParams {
    payload?: Record<string, any>;
    nextRunAt?: Date | string;
    cronExpression?: string;
    status?: ScheduleStatus;
    metadata?: Record<string, any>;
}
