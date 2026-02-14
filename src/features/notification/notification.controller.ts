import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.util';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import notificationService from './notification.service';

export class NotificationController {

    // Get notifications
    static async getNotifications(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const offset = (page - 1) * limit;
            const unreadOnly = req.query.unread === 'true';

            const result = await notificationService.getUserNotifications(
                userId,
                limit,
                offset,
                unreadOnly
            );

            ResponseHelper.paginated(res, result.notifications, {
                total: result.total,
                page,
                limit,
                unreadCount: result.unreadCount,
                totalPages: Math.ceil(result.total / limit)
            } as any, 'Notifications retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve notifications', 500, error);
        }
    }

    // Mark one as read
    static async markAsRead(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            await notificationService.markAsRead(userId, id);
            ResponseHelper.success(res, null, 'Notification marked as read');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to mark notification as read', 500, error);
        }
    }

    // Mark all as read
    static async markAllAsRead(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            await notificationService.markAllAsRead(userId);
            ResponseHelper.success(res, null, 'All notifications marked as read');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to mark all notifications as read', 500, error);
        }
    }

    // Delete notification
    static async deleteNotification(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            await notificationService.delete(userId, id);
            ResponseHelper.success(res, null, 'Notification deleted');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to delete notification', 500, error);
        }
    }
}
