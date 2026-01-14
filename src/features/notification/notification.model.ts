import mongoose, { Schema } from 'mongoose';
import { INotificationDocument, NotificationType } from './notification.types';

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
