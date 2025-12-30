import { Request, Response, NextFunction } from 'express';
import { WidgetService } from './widget.service';
import { asyncHandler, createError } from '../../core/middleware/errorHandler';
import { ResponseHelper } from '../../core/utils/response';
import { AuthenticatedRequest } from '../../shared/types';

const widgetService = new WidgetService();

export const createWidget = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw createError('Not authenticated', 401);

    const widget = await widgetService.createWidget(req.user._id.toString(), req.body);

    ResponseHelper.created(res, widget);
});

export const getWidgets = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw createError('Not authenticated', 401);

    const widgets = await widgetService.getWidgets(req.user._id.toString());

    ResponseHelper.success(res, widgets);
});

export const updateWidget = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw createError('Not authenticated', 401);

    const widget = await widgetService.updateWidget(req.user._id.toString(), req.params.id, req.body);

    ResponseHelper.success(res, widget);
});

export const deleteWidget = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw createError('Not authenticated', 401);

    await widgetService.deleteWidget(req.user._id.toString(), req.params.id);

    ResponseHelper.success(res, null, 'Widget deleted');
});

export const reorderWidgets = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) throw createError('Not authenticated', 401);

    const { widgetIds } = req.body;
    if (!Array.isArray(widgetIds)) {
        throw createError('widgetIds must be an array of strings', 400);
    }

    await widgetService.reorderWidgets(req.user._id.toString(), widgetIds);

    ResponseHelper.success(res, null, 'Widgets reordered successfully');
});
