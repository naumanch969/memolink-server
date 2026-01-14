import { Router } from 'express';
import notificationController from './notification.controller';
import { authenticate } from '../../core/middleware/authMiddleware';

const router = Router();

// Apply auth middleware to all routes
router.use(authenticate);

router.get('/', notificationController.getNotifications);
router.put('/mark-all-read', notificationController.markAllAsRead);
router.put('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);

export default router;
