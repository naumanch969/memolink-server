
import { Router } from 'express';
import { BadgeController } from './badge.controller';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { USER_ROLES } from '../../shared/constants';

const router = Router();

// Publicly available within authenticated session
router.use(AuthMiddleware.authenticate);

router.get('/me', BadgeController.getMyBadges);
router.get('/available', BadgeController.getAvailableBadges);

// Admin only: Management & Stats
router.use(AuthMiddleware.authorize(USER_ROLES.ADMIN));

router.get('/admin/all', BadgeController.getAllBadgesAdmin);
router.get('/admin/stats', BadgeController.getBadgeStats);
router.post('/admin', BadgeController.createBadge);
router.patch('/admin/:id', BadgeController.updateBadge);
router.delete('/admin/:id', BadgeController.deleteBadge);
router.post('/award', BadgeController.awardBadge);
router.post('/seed', BadgeController.seedBadges);

export default router;
