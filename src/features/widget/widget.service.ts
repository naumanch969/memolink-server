import { Types } from 'mongoose';
import { ApiError } from '../../core/errors/api.error';
import { CreateWidgetParams, UpdateWidgetParams } from './widget.interfaces';
import { Widget } from './widget.model';

export class WidgetService {
    async createWidget(userId: string, params: CreateWidgetParams) {
        // Get highest order to append to end
        const lastWidget = await Widget.findOne({ user: new Types.ObjectId(userId) })
            .sort({ order: -1 })
            .select('order');

        const order = params.order ?? (lastWidget ? lastWidget.order + 1 : 0);

        const widget = await Widget.create({
            user: new Types.ObjectId(userId),
            ...params,
            order,
        });

        return widget;
    }

    async getWidgets(userId: string) {
        return Widget.find({ user: new Types.ObjectId(userId) }).sort({ order: 1 });
    }

    async updateWidget(userId: string, widgetId: string, params: UpdateWidgetParams) {
        const widget = await Widget.findOne({
            _id: new Types.ObjectId(widgetId),
            user: new Types.ObjectId(userId),
        });

        if (!widget) {
            throw ApiError.notFound('Widget');
        }

        if (params.title !== undefined) widget.title = params.title;
        if (params.data !== undefined) {
            widget.data = params.data;
            // Mark the data field as modified since it's a Mixed type
            // This ensures Mongoose saves nested changes like completedAt timestamps
            widget.markModified('data');
        }
        if (params.order !== undefined) widget.order = params.order;
        if (params.group !== undefined) widget.group = params.group;
        if (params.isPinned !== undefined) widget.isPinned = params.isPinned;

        await widget.save();
        return widget;
    }

    async deleteWidget(userId: string, widgetId: string) {
        const result = await Widget.deleteOne({
            _id: new Types.ObjectId(widgetId),
            user: new Types.ObjectId(userId),
        });

        if (result.deletedCount === 0) {
            throw ApiError.notFound('Widget');
        }
    }

    async reorderWidgets(userId: string, widgetIds: string[]) {
        const bulkOps = widgetIds.map((id, index) => ({
            updateOne: {
                filter: { _id: new Types.ObjectId(id), user: new Types.ObjectId(userId) },
                update: { $set: { order: index } },
            },
        }));

        if (bulkOps.length > 0) {
            await Widget.bulkWrite(bulkOps);
        }
    }
}
