import express from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ReportController } from './report.controller';

const router = express.Router();

router.use(AuthMiddleware.authenticate);

router.get('/', ReportController.getReports);
router.get('/:id', ReportController.getReport);
router.post('/generate', ReportController.generateOnDemand);
router.post('/from-task', ReportController.createFromTask);

export default router;
