import { Response } from 'express';
import notificationService from './notification.service';
import { ResponseHelper } from '../../core/utils/response';
import { asyncHandler } from '../../core/middleware/errorHandler';
import { AuthenticatedRequest } from '../../shared/types';

class NotificationController {

    // Get notifications
    getNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
    });

    // Mark one as read
    markAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!._id.toString();
        const { id } = req.params;
        await notificationService.markAsRead(userId, id);
        ResponseHelper.success(res, null, 'Notification marked as read');
    });

    // Mark all as read
    markAllAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!._id.toString();
        await notificationService.markAllAsRead(userId);
        ResponseHelper.success(res, null, 'All notifications marked as read');
    });

    // Delete notification
    deleteNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user!._id.toString();
        const { id } = req.params;
        await notificationService.delete(userId, id);
        ResponseHelper.success(res, null, 'Notification deleted');
    });
}

export default new NotificationController();
