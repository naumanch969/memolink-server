import mongoose, { Schema } from 'mongoose';
import { INotificationDocument, INotificationQueueDocument, NotificationStatus, NotificationType } from './notification.types';

const NotificationSchema = new Schema<INotificationDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        type: {
            type: String,
            enum: Object.values(NotificationType),
            required: true
        },
        title: { type: String, required: true },
        message: { type: String, required: true },
        isRead: { type: Boolean, default: false, index: true },
        referenceId: { type: Schema.Types.ObjectId }, // Dynamic ref
        referenceModel: { type: String }, // Usage: refPath in a more complex setup, or manual lookup
        actionUrl: { type: String },
        eventId: { type: String, unique: true, sparse: true },
    },
    {
        timestamps: true,
        // Capped collection candidate? Maybe not for now.
    }
);

// Indexes
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotificationDocument>('Notification', NotificationSchema);


const NotificationQueueSchema = new Schema<INotificationQueueDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true, },
        reminderId: { type: Schema.Types.ObjectId, ref: 'Reminder', required: true, index: true, },
        scheduledFor: { type: Date, required: true, index: true, },
        status: { type: String, enum: Object.values(NotificationStatus), default: NotificationStatus.PENDING, index: true, },
        attempts: { type: Number, default: 0 },
        sentAt: { type: Date, },
        error: { type: String, },
    },
    { timestamps: true, }
);

// Indexes for notification processing
NotificationQueueSchema.index({ status: 1, scheduledFor: 1 });
NotificationQueueSchema.index({ reminderId: 1, status: 1 });

export const NotificationQueue = mongoose.model<INotificationQueueDocument>('NotificationQueue', NotificationQueueSchema);
