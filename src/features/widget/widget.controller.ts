import { Response } from 'express';
import { ApiError } from '../../core/errors/api.error';
import { ResponseHelper } from '../../core/utils/response.utils';
import { AuthenticatedRequest } from '../auth/auth.interfaces';
import { WidgetService } from './widget.service';

const widgetService = new WidgetService();

export class WidgetController {
    static async createWidget(req: AuthenticatedRequest, res: Response) {
        try {
            if (!req.user) throw ApiError.unauthorized('Not authenticated');

            const widget = await widgetService.createWidget(req.user._id.toString(), req.body);

            ResponseHelper.created(res, widget);
        } catch (error) {
            ResponseHelper.error(res, 'Failed to create widget', 500, error);
        }
    }

    static async getWidgets(req: AuthenticatedRequest, res: Response) {
        try {
            if (!req.user) throw ApiError.unauthorized('Not authenticated');

            const widgets = await widgetService.getWidgets(req.user._id.toString());

            ResponseHelper.success(res, widgets);
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve widgets', 500, error);
        }
    }

    static async updateWidget(req: AuthenticatedRequest, res: Response) {
        try {
            if (!req.user) throw ApiError.unauthorized('Not authenticated');

            const widget = await widgetService.updateWidget(req.user._id.toString(), req.params.id, req.body);

            ResponseHelper.success(res, widget);
        } catch (error) {
            ResponseHelper.error(res, 'Failed to update widget', 500, error);
        }
    }

    static async deleteWidget(req: AuthenticatedRequest, res: Response) {
        try {
            if (!req.user) throw ApiError.unauthorized('Not authenticated');

            await widgetService.deleteWidget(req.user._id.toString(), req.params.id);

            ResponseHelper.success(res, null, 'Widget deleted');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to delete widget', 500, error);
        }
    }

    static async reorderWidgets(req: AuthenticatedRequest, res: Response) {
        try {
            if (!req.user) throw ApiError.unauthorized('Not authenticated');

            const { widgetIds } = req.body;
            if (!Array.isArray(widgetIds)) {
                throw ApiError.badRequest('widgetIds must be an array of strings');
            }

            await widgetService.reorderWidgets(req.user._id.toString(), widgetIds);

            ResponseHelper.success(res, null, 'Widgets reordered successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to reorder widgets', 500, error);
        }
    }
}
