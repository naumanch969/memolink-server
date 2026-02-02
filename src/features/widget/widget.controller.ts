import { Response } from 'express';
import { createError } from '../../core/middleware/errorHandler';
import { ResponseHelper } from '../../core/utils/response';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { WidgetService } from './widget.service';

const widgetService = new WidgetService();

export class WidgetController {
    static async createWidget(req: AuthenticatedRequest, res: Response) {
        try {
            if (!req.user) throw createError('Not authenticated', 401);

            const widget = await widgetService.createWidget(req.user._id.toString(), req.body);

            ResponseHelper.created(res, widget);
        } catch (error) {
            ResponseHelper.error(res, 'Failed to create widget', 500, error);
        }
    }

    static async getWidgets(req: AuthenticatedRequest, res: Response) {
        try {
            if (!req.user) throw createError('Not authenticated', 401);

            const widgets = await widgetService.getWidgets(req.user._id.toString());

            ResponseHelper.success(res, widgets);
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve widgets', 500, error);
        }
    }

    static async updateWidget(req: AuthenticatedRequest, res: Response) {
        try {
            if (!req.user) throw createError('Not authenticated', 401);

            const widget = await widgetService.updateWidget(req.user._id.toString(), req.params.id, req.body);

            ResponseHelper.success(res, widget);
        } catch (error) {
            ResponseHelper.error(res, 'Failed to update widget', 500, error);
        }
    }

    static async deleteWidget(req: AuthenticatedRequest, res: Response) {
        try {
            if (!req.user) throw createError('Not authenticated', 401);

            await widgetService.deleteWidget(req.user._id.toString(), req.params.id);

            ResponseHelper.success(res, null, 'Widget deleted');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to delete widget', 500, error);
        }
    }

    static async reorderWidgets(req: AuthenticatedRequest, res: Response) {
        try {
            if (!req.user) throw createError('Not authenticated', 401);

            const { widgetIds } = req.body;
            if (!Array.isArray(widgetIds)) {
                throw createError('widgetIds must be an array of strings', 400);
            }

            await widgetService.reorderWidgets(req.user._id.toString(), widgetIds);

            ResponseHelper.success(res, null, 'Widgets reordered successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to reorder widgets', 500, error);
        }
    }
}
