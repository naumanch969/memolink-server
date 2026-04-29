import express from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ReportController } from './report.controller';

const router = express.Router();

router.use(AuthMiddleware.authenticate);

router.get('/', ReportController.getReports);
router.get('/eligibility', ReportController.checkEligibility);
router.get('/:id', ReportController.getReport);
router.post('/generate', ReportController.generateOnDemand);

export default router;
