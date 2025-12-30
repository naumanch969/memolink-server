import { Router } from 'express';
import { authenticate } from '../../core/middleware/authMiddleware';
import * as widgetController from './widget.controller';

const router = Router();

// Protect all routes
router.use(authenticate);

router
    .route('/')
    .get(widgetController.getWidgets)
    .post(widgetController.createWidget);

router.post('/reorder', widgetController.reorderWidgets);

router
    .route('/:id')
    .patch(widgetController.updateWidget)
    .delete(widgetController.deleteWidget);

export default router;
