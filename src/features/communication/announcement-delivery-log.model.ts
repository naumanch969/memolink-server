import mongoose, { Document, Schema, Types } from 'mongoose';

export enum DeliveryStatus {
    QUEUED = 'queued',
    SENT = 'sent',
    FAILED = 'failed',
}

export interface IAnnouncementDeliveryLog extends Document {
    announcementId: Types.ObjectId;
    userId: Types.ObjectId;
    recipientEmail: string;
    recipientName?: string;
    status: DeliveryStatus;
    attempts: number;
    error?: {
        message: string;
        code?: string;
        stack?: string;
    };
    sentAt?: Date;
    failedAt?: Date;
}

const announcementDeliveryLogSchema = new Schema<IAnnouncementDeliveryLog>({
    announcementId: { type: Schema.Types.ObjectId, ref: 'Announcement', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipientEmail: { type: String, required: true },
    recipientName: { type: String },
    status: {
        type: String,
        enum: Object.values(DeliveryStatus),
        default: DeliveryStatus.QUEUED,
        index: true
    },
    attempts: { type: Number, default: 0 },
    error: {
        message: { type: String },
        code: { type: String },
        stack: { type: String }
    },
    sentAt: { type: Date },
    failedAt: { type: Date },
}, {
    timestamps: true,
});

// Compound index for efficient querying
announcementDeliveryLogSchema.index({ announcementId: 1, status: 1 });
announcementDeliveryLogSchema.index({ announcementId: 1, createdAt: -1 });

export const AnnouncementDeliveryLog = mongoose.model<IAnnouncementDeliveryLog>('AnnouncementDeliveryLog', announcementDeliveryLogSchema);
