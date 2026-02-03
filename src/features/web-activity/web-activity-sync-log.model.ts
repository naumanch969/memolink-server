
import { Document, Schema, Types, model } from 'mongoose';

export interface IWebActivitySyncLog extends Document {
    userId: Types.ObjectId;
    syncId: string;
    createdAt: Date;
}

const syncLogSchema = new Schema<IWebActivitySyncLog>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        syncId: { type: String, required: true },
        createdAt: { type: Date, default: Date.now, expires: '7d' } // Keep logs for 7 days to manage storage
    }
);

// Compound index for uniqueness per user/syncId
syncLogSchema.index({ userId: 1, syncId: 1 }, { unique: true });

export const WebActivitySyncLog = model<IWebActivitySyncLog>('WebActivitySyncLog', syncLogSchema);
