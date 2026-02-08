
import { Document, Schema, Types, model } from 'mongoose';

export interface IDomainLimit {
    domain: string;
    dailyLimitMinutes: number; // Max allowed minutes per day
    action: 'nudge' | 'block'; // 'nudge' = show warning, 'block' = hard block
    enabled: boolean;
}

export interface IActivityDefinitions extends Document {
    userId: Types.ObjectId;
    productiveDomains: string[];
    distractingDomains: string[];
    domainLimits: IDomainLimit[];
    updatedAt: Date;
}

const domainLimitSchema = new Schema<IDomainLimit>(
    {
        domain: { type: String, required: true },
        dailyLimitMinutes: { type: Number, required: true, min: 1 },
        action: { type: String, enum: ['nudge', 'block'], default: 'nudge' },
        enabled: { type: Boolean, default: true },
    },
    { _id: true }
);

const activityDefinitionsSchema = new Schema<IActivityDefinitions>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
        productiveDomains: { type: [String], default: [] },
        distractingDomains: { type: [String], default: [] },
        domainLimits: { type: [domainLimitSchema], default: [] },
    },
    { timestamps: true }
);

export const ActivityDefinitions = model<IActivityDefinitions>('ActivityDefinitions', activityDefinitionsSchema);
