import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { USER_ROLES } from '../../shared/constants';
import { AnnouncementController } from './announcement.controller';

const router = Router();

router.use(AuthMiddleware.authenticate);
router.get('/', AnnouncementController.getAll);
router.get('/:id', AnnouncementController.getOne);

router.use(AuthMiddleware.authorize(USER_ROLES.ADMIN))
router.post('/', AnnouncementController.create);
router.put('/:id', AnnouncementController.update);
router.delete('/:id', AnnouncementController.delete);
router.post('/:id/send', AnnouncementController.send);
router.get('/:id/logs', AnnouncementController.getDeliveryLogs);

export default router;
