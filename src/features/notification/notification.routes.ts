import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { NotificationController } from './notification.controller';
import { getNotificationsValidation, notificationIdValidation } from './notification.validations';

const router = Router();

// Apply auth middleware to all routes
router.use(AuthMiddleware.authenticate);

router.get('/', getNotificationsValidation, ValidationMiddleware.validate, NotificationController.getNotifications);
router.post('/token', NotificationController.registerPushToken);
router.put('/mark-all-read', NotificationController.markAllAsRead);
router.put('/:id/read', notificationIdValidation, ValidationMiddleware.validate, NotificationController.markAsRead);
router.delete('/:id', notificationIdValidation, ValidationMiddleware.validate, NotificationController.deleteNotification);

export default router;
