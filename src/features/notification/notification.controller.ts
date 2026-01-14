import { Response } from 'express';
import notificationService from './notification.service';
import { authenticate } from '../../core/middleware/authMiddleware';
import { AuthenticatedRequest } from '../../shared/types';

class NotificationController {

    // Get notifications
    getNotifications = async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;
        const unreadOnly = req.query.unread === 'true';

        const result = await notificationService.getUserNotifications(
            req.user._id.toString(),
            limit,
            offset,
            unreadOnly
        );

        res.json({
            data: result.notifications,
            meta: {
                total: result.total,
                unreadCount: result.unreadCount,
                page,
                limit
            }
        });
    };

    // Mark one as read
    markAsRead = async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        await notificationService.markAsRead(req.user._id.toString(), id);
        res.json({ success: true, message: 'Notification marked as read' });
    };

    // Mark all as read
    markAllAsRead = async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        await notificationService.markAllAsRead(req.user._id.toString());
        res.json({ success: true, message: 'All notifications marked as read' });
    };

    // Delete notification
    deleteNotification = async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const { id } = req.params;
        await notificationService.delete(req.user._id.toString(), id);
        res.json({ success: true, message: 'Notification deleted' });
    };
}

export default new NotificationController();
