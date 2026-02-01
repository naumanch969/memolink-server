import { Types } from 'mongoose';
import { CustomError } from '../../core/middleware/errorHandler';
import { Notification } from './notification.model';
import { CreateNotificationDTO, INotificationDocument } from './notification.types';

export class NotificationService {

    // Create a new notification
    async create(data: CreateNotificationDTO): Promise<INotificationDocument> {
        try {
            const notification = await Notification.create({
                userId: new Types.ObjectId(data.userId),
                type: data.type,
                title: data.title,
                message: data.message,
                referenceId: data.referenceId ? new Types.ObjectId(data.referenceId) : undefined,
                referenceModel: data.referenceModel,
                actionUrl: data.actionUrl,
                isRead: false
            });
            return notification;
        } catch (error: any) {
            throw new CustomError('Failed to create notification', 500);
        }
    }

    // Get notifications for a user
    async getUserNotifications(userId: string, limit: number = 20, offset: number = 0, unreadOnly: boolean = false) {
        try {
            const query: any = { userId: new Types.ObjectId(userId) };
            if (unreadOnly) {
                query.isRead = false;
            }

            const [notifications, total] = await Promise.all([
                Notification.find(query)
                    .sort({ createdAt: -1 })
                    .skip(offset)
                    .limit(limit)
                    .lean(),
                Notification.countDocuments(query)
            ]);

            const unreadCount = await Notification.countDocuments({
                userId: new Types.ObjectId(userId),
                isRead: false
            });

            return { notifications, total, unreadCount };
        } catch (error: any) {
            throw new CustomError('Failed to fetch notifications', 500);
        }
    }

    // Mark as read
    async markAsRead(userId: string, notificationId: string): Promise<void> {
        try {
            await Notification.updateOne(
                { _id: new Types.ObjectId(notificationId), userId: new Types.ObjectId(userId) },
                { $set: { isRead: true } }
            );
        } catch (error) {
            throw new CustomError('Failed to mark notification as read', 500);
        }
    }

    // Mark all as read
    async markAllAsRead(userId: string): Promise<void> {
        try {
            await Notification.updateMany(
                { userId: new Types.ObjectId(userId), isRead: false },
                { $set: { isRead: true } }
            );
        } catch (error) {
            throw new CustomError('Failed to mark all as read', 500);
        }
    }

    // Delete a notification
    async delete(userId: string, notificationId: string): Promise<void> {
        try {
            await Notification.deleteOne({
                _id: new Types.ObjectId(notificationId),
                userId: new Types.ObjectId(userId)
            });
        } catch (error) {
            throw new CustomError('Failed to delete notification', 500);
        }
    }

    // Delete all user data (Cascade Delete)
    async deleteUserData(userId: string): Promise<number> {
        const result = await Notification.deleteMany({ userId });
        return result.deletedCount || 0;
    }
}

export const notificationService = new NotificationService();
export default notificationService;
