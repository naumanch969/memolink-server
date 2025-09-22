import { Router } from 'express';
import { ExportController } from './export.controller';
import { authenticate } from '../../core/middleware/authMiddleware';
import { exportValidation } from './export.validations';
import { validationMiddleware } from '../../core/middleware/validationMiddleware';

const router = Router();

router.use(authenticate);

router.post('/', exportValidation, validationMiddleware, ExportController.exportData);

export default router;
