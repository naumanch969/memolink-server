import { Router } from 'express';
import { authenticate } from '../../core/middleware/authMiddleware';
import { validationMiddleware } from '../../core/middleware/validationMiddleware';
import { ExportController } from './export.controller';
import { exportValidation } from './export.validations';

const router = Router();

router.use(authenticate);

router.post('/', exportValidation, validationMiddleware, ExportController.exportData);

export default router;
