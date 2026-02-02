import { Router } from 'express';
import { authenticate } from '../../core/middleware/authMiddleware';
import { WidgetController } from './widget.controller';

const router = Router();

// Protect all routes
router.use(authenticate);

router.get('/', WidgetController.getWidgets);
router.post('/', WidgetController.createWidget);
router.post('/reorder', WidgetController.reorderWidgets);
router.patch('/:id', WidgetController.updateWidget);
router.delete('/:id', WidgetController.deleteWidget);

export default router;
