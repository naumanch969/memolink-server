import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { USER_ROLES } from '../../shared/constants';
import { AnnouncementController } from './announcement.controller';
import { announcementIdValidation, createAnnouncementValidation, updateAnnouncementValidation } from './announcement.validations';

const router = Router();

router.use(AuthMiddleware.authenticate);
router.get('/', AnnouncementController.getAll);
router.get('/:id', announcementIdValidation, ValidationMiddleware.validate, AnnouncementController.getOne);

router.use(AuthMiddleware.authorize(USER_ROLES.ADMIN))
router.post('/', createAnnouncementValidation, ValidationMiddleware.validate, AnnouncementController.create);
router.put('/:id', updateAnnouncementValidation, ValidationMiddleware.validate, AnnouncementController.update);
router.delete('/:id', announcementIdValidation, ValidationMiddleware.validate, AnnouncementController.delete);
router.post('/:id/send', announcementIdValidation, ValidationMiddleware.validate, AnnouncementController.send);
router.get('/:id/logs', announcementIdValidation, ValidationMiddleware.validate, AnnouncementController.getDeliveryLogs);

export default router;
