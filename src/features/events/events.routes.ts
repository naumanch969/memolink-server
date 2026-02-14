import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { EventsController } from './events.controller';
import { ingestEventsValidation } from './events.validations';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.post('/', ingestEventsValidation, ValidationMiddleware.validate, EventsController.ingest);

export default router;
