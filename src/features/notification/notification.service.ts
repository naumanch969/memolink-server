import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { ApiError } from '../../core/errors/api.error';
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
                eventId: data.eventId,
                isRead: false
            });

            return notification;
        } catch (error: any) {
            // Handle duplicate eventId (idempotency)
            if (error.code === 11000 && error.keyPattern?.eventId) {
                return (await Notification.findOne({ eventId: data.eventId })) as INotificationDocument;
            }
            throw ApiError.internal('Failed to create notification');
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
            throw ApiError.internal('Failed to fetch notifications');
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
            throw ApiError.internal('Failed to mark notification as read');
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
            throw ApiError.internal('Failed to mark all as read');
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
            throw ApiError.internal('Failed to delete notification');
        }
    }

    // Delete all user data (Cascade Delete)
    async deleteUserData(userId: string): Promise<number> {
        const result = await Notification.deleteMany({ userId });
        return result.deletedCount || 0;
    }

    // Cleanup old notifications
    async cleanupOldNotifications(): Promise<number> {
        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

            // 1. Delete read notifications older than 30 days
            const readResult = await Notification.deleteMany({
                isRead: true,
                updatedAt: { $lte: thirtyDaysAgo }
            });

            // 2. Delete ALL notifications older than 90 days
            const allResult = await Notification.deleteMany({
                createdAt: { $lte: ninetyDaysAgo }
            });

            const total = (readResult.deletedCount || 0) + (allResult.deletedCount || 0);
            if (total > 0) {
                logger.info(`[NotificationService] Cleaned up ${total} old notifications`);
            }
            return total;
        } catch (error) {
            logger.error('[NotificationService] Cleanup failed', error);
            return 0;
        }
    }

    // Register push token
    async registerPushToken(userId: string, token: string, platform: string): Promise<void> {
        try {
            const { User } = await import('../auth/auth.model');

            // Find user and check if token already exists to avoid duplicates
            const user = await User.findById(userId);
            if (!user) throw ApiError.notFound('User');

            // Initialize pushTokens if it doesn't exist (should be handled by schema default but being safe)
            if (!user.pushTokens) user.pushTokens = [];

            // Check if token exists
            const tokenExists = user.pushTokens.some(pt => pt.token === token);
            if (!tokenExists) {
                user.pushTokens.push({
                    token,
                    platform,
                    createdAt: new Date()
                });

                // Keep only last 5 devices to avoid bloat
                if (user.pushTokens.length > 5) {
                    user.pushTokens.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                    user.pushTokens = user.pushTokens.slice(0, 5);
                }

                await user.save();
            }
        } catch (error: any) {
            if (error instanceof ApiError) throw error;
            throw ApiError.internal('Failed to register push token');
        }
    }
}

export const notificationService = new NotificationService();
export default notificationService;
