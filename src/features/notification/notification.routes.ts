import { Router } from 'express';
import { authenticate } from '../../core/middleware/authMiddleware';
import { NotificationController } from './notification.controller';

const router = Router();

// Apply auth middleware to all routes
router.use(authenticate);

router.get('/', NotificationController.getNotifications);
router.put('/mark-all-read', NotificationController.markAllAsRead);
router.put('/:id/read', NotificationController.markAsRead);
router.delete('/:id', NotificationController.deleteNotification);

export default router;
