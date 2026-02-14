import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

// Apply auth middleware to all routes
router.use(AuthMiddleware.authenticate);

router.get('/', NotificationController.getNotifications);
router.put('/mark-all-read', NotificationController.markAllAsRead);
router.put('/:id/read', NotificationController.markAsRead);
router.delete('/:id', NotificationController.deleteNotification);

export default router;
