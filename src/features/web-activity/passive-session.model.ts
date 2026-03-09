import { Document, Schema, Types, model } from 'mongoose';
import { BaseEntity } from '../../shared/types';
import { SignalTier } from '../enrichment/enrichment.types';
import { WebActivityEvent } from './web-activity.types';

export interface IPassiveSessionMetrics {
    contextSwitchCount: number;
    flowDuration: number;
    totalActiveTime: number;
}

export interface IPassiveSession extends BaseEntity {
    userId: Types.ObjectId;
    date: string;
    startTime: Date;
    endTime: Date;
    primaryCategory: string;
    metrics: IPassiveSessionMetrics;
    rawLogs: WebActivityEvent[];
    signalTier: SignalTier;
    enrichmentRef?: Types.ObjectId;
}

export type PassiveSessionDocument = IPassiveSession & Document;

const webActivityEventSchema = new Schema<WebActivityEvent>(
    {
        domain: { type: String, required: true },
        url: { type: String, required: true },
        title: { type: String, default: '' },
        startTime: { type: Number, required: true },
        endTime: { type: Number, required: true },
        duration: { type: Number, required: true },
    },
    { _id: false }
);

const passiveSessionSchema = new Schema<IPassiveSession>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        date: { type: String, required: true, index: true },
        startTime: { type: Date, required: true, index: true },
        endTime: { type: Date, required: true },
        primaryCategory: { type: String, default: 'neutral' },
        metrics: {
            contextSwitchCount: { type: Number, default: 0 },
            flowDuration: { type: Number, default: 0 },
            totalActiveTime: { type: Number, default: 0 },
        },
        rawLogs: { type: [webActivityEventSchema], default: [] },
        signalTier: {
            type: String,
            enum: ['noise', 'log', 'signal', 'deep_signal'],
            required: true
        },
        enrichmentRef: { type: Schema.Types.ObjectId, ref: 'EnrichedEntry' },
    },
    {
        timestamps: true,
    }
);

// Compound index for finding user's sessions on a specific day sorted by time
passiveSessionSchema.index({ userId: 1, date: 1, startTime: 1 });

export const PassiveSession = model<IPassiveSession>('PassiveSession', passiveSessionSchema);
