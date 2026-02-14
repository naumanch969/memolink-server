import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { MoodController } from './mood.controller';
import { listMoodsValidation, upsertMoodValidation } from './mood.validations';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.get('/', listMoodsValidation, ValidationMiddleware.validate, MoodController.list);
router.post('/', upsertMoodValidation, ValidationMiddleware.validate, MoodController.upsert);

export default router;
