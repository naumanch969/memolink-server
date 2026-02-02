import { Router } from 'express';
import { authenticate, authorize } from '../../core/middleware/authMiddleware';
import { USER_ROLES } from '../../shared/constants';
import { AnnouncementController } from './announcement.controller';

const router = Router();

// Retrieve announcements (public for users, but implementation might return targeted only if extended)
// User-facing routes
router.get('/', authenticate, AnnouncementController.getAll);
router.get('/:id', authenticate, AnnouncementController.getOne);

// Admin-only routes
router.post('/', authenticate, authorize(USER_ROLES.ADMIN), AnnouncementController.create);
router.put('/:id', authenticate, authorize(USER_ROLES.ADMIN), AnnouncementController.update);
router.delete('/:id', authenticate, authorize(USER_ROLES.ADMIN), AnnouncementController.delete);
router.post('/:id/send', authenticate, authorize(USER_ROLES.ADMIN), AnnouncementController.send);
router.get('/:id/logs', authenticate, authorize(USER_ROLES.ADMIN), AnnouncementController.getDeliveryLogs);

export default router;
