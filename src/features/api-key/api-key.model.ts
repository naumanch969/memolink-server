import mongoose, { Model, Schema } from 'mongoose';
import { IApiKeyDocument } from './api-key.types';

const apiKeySchema = new Schema<IApiKeyDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        name: { type: String, required: true, trim: true, maxlength: 100 },
        hashedKey: { type: String, required: true, select: false },
        prefix: { type: String, required: true },
        lastUsedAt: { type: Date, default: null },
        expiresAt: { type: Date, default: null },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

export const ApiKey: Model<IApiKeyDocument> = mongoose.model<IApiKeyDocument>('ApiKey', apiKeySchema);
export default ApiKey;
