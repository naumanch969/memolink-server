import { Router } from 'express';
import { WidgetController } from './widget.controller';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

// Protect all routes
router.use(AuthMiddleware.authenticate);

router.get('/', WidgetController.getWidgets);
router.post('/', WidgetController.createWidget);
router.post('/reorder', WidgetController.reorderWidgets);
router.patch('/:id', WidgetController.updateWidget);
router.delete('/:id', WidgetController.deleteWidget);

export default router;
