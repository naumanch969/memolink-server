
import { Router } from 'express';
import { BadgeController } from './badge.controller';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { USER_ROLES } from '../../shared/constants';

const router = Router();

// Publicly available within authenticated session
router.use(AuthMiddleware.authenticate);

router.get('/me', BadgeController.getMyBadges);
router.get('/available', BadgeController.getAvailableBadges);

// Admin only: Award badge
router.post('/award', AuthMiddleware.authorize(USER_ROLES.ADMIN), BadgeController.awardBadge);

export default router;
