
import { Document, Schema, Types, model } from 'mongoose';

export interface IActivityDefinitions extends Document {
    userId: Types.ObjectId;
    productiveDomains: string[];
    distractingDomains: string[];
    updatedAt: Date;
}

const activityDefinitionsSchema = new Schema<IActivityDefinitions>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
        productiveDomains: { type: [String], default: [] },
        distractingDomains: { type: [String], default: [] }
    },
    { timestamps: true }
);

export const ActivityDefinitions = model<IActivityDefinitions>('ActivityDefinitions', activityDefinitionsSchema);
