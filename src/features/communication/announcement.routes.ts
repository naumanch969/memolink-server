import { Router } from 'express';
import { authenticate, authorize } from '../../core/middleware/authMiddleware';
import { USER_ROLES } from '../../shared/constants';
import { announcementController } from './announcement.controller';

const router = Router();

// Retrieve announcements (public for users, but implementation might return targeted only if extended)
// User-facing routes
router.get('/', authenticate, announcementController.getAll);
router.get('/:id', authenticate, announcementController.getOne);

// Admin-only routes
router.post('/', authenticate, authorize(USER_ROLES.ADMIN), announcementController.create);
router.put('/:id', authenticate, authorize(USER_ROLES.ADMIN), announcementController.update);
router.delete('/:id', authenticate, authorize(USER_ROLES.ADMIN), announcementController.delete);
router.post('/:id/send', authenticate, authorize(USER_ROLES.ADMIN), announcementController.send);
router.get('/:id/logs', authenticate, authorize(USER_ROLES.ADMIN), announcementController.getDeliveryLogs);

export default router;
