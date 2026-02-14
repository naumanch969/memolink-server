import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { WidgetController } from './widget.controller';
import { createWidgetValidation, reorderWidgetsValidation, updateWidgetValidation, widgetIdValidation } from './widget.validations';

const router = Router();

// Protect all routes
router.use(AuthMiddleware.authenticate);

router.get('/', WidgetController.getWidgets);
router.post('/', createWidgetValidation, ValidationMiddleware.validate, WidgetController.createWidget);
router.post('/reorder', reorderWidgetsValidation, ValidationMiddleware.validate, WidgetController.reorderWidgets);
router.patch('/:id', updateWidgetValidation, ValidationMiddleware.validate, WidgetController.updateWidget);
router.delete('/:id', widgetIdValidation, ValidationMiddleware.validate, WidgetController.deleteWidget);

export default router;
