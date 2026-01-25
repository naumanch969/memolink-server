import mongoose, { Document, Schema, Types } from 'mongoose';

export enum AnnouncementType {
    ANNOUNCEMENT = 'announcement',
    NEWSLETTER = 'newsletter',
    SECURITY_ALERT = 'security_alert',
}

export enum AnnouncementStatus {
    DRAFT = 'draft',
    SCHEDULED = 'scheduled',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
}

export interface IAnnouncement extends Document {
    title: string;
    content: string; // HTML content
    type: AnnouncementType;
    target: {
        roles?: string[]; // e.g. ['user', 'admin']
        // In future we can add more granular targeting like 'hasTag', 'isActiveSince', etc.
    };
    status: AnnouncementStatus;
    scheduledAt?: Date;
    sentAt?: Date;
    stats: {
        totalRecipients: number;
        queuedCount: number;      // Total emails queued
        sentCount: number;         // Successfully sent
        failedCount: number;       // Failed to send
        invalidEmailCount: number; // Invalid email addresses skipped
        progress: number;          // Percentage (0-100)
    };
    authorId: Types.ObjectId;
}

const announcementSchema = new Schema<IAnnouncement>({
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    type: {
        type: String,
        enum: Object.values(AnnouncementType),
        default: AnnouncementType.ANNOUNCEMENT
    },
    target: {
        roles: [{ type: String }],
    },
    status: {
        type: String,
        enum: Object.values(AnnouncementStatus),
        default: AnnouncementStatus.DRAFT
    },
    scheduledAt: { type: Date },
    sentAt: { type: Date },
    stats: {
        totalRecipients: { type: Number, default: 0 },
        queuedCount: { type: Number, default: 0 },
        sentCount: { type: Number, default: 0 },
        failedCount: { type: Number, default: 0 },
        invalidEmailCount: { type: Number, default: 0 },
        progress: { type: Number, default: 0 },
    },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, {
    timestamps: true,
});

// Indexes
announcementSchema.index({ status: 1 });
announcementSchema.index({ scheduledAt: 1 });

export const Announcement = mongoose.model<IAnnouncement>('Announcement', announcementSchema);
