import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { ExportController } from './export.controller';
import { exportValidation } from './export.validations';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.post('/', exportValidation, ValidationMiddleware.validate, ExportController.exportData);

export default router;
