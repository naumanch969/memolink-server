import { Router } from 'express';
import { validationMiddleware } from '../../core/middleware/validation.middleware';
import { ExportController } from './export.controller';
import { exportValidation } from './export.validations';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.post('/', exportValidation, validationMiddleware, ExportController.exportData);

export default router;
