import { Types } from 'mongoose';
import { ApiError } from '../../core/errors/api.error';
import { List } from './list.model';
import { CreateListParams, UpdateListParams } from './list.types';

export class ListService {
    async createList(userId: string, params: CreateListParams) {
        // Get highest order to append to end
        const lastList = await List.findOne({ user: new Types.ObjectId(userId) })
            .sort({ order: -1 })
            .select('order');

        const order = params.order ?? (lastList ? lastList.order + 1 : 0);

        const list = await List.create({
            user: new Types.ObjectId(userId),
            ...params,
            order,
        });

        return list;
    }

    async getLists(userId: string) {
        const lists = await List.find({ user: new Types.ObjectId(userId) }).sort({ order: 1 });
        const hasBacklog = lists.some(l => l.isSystem && l.title === 'Backlog');

        if (!hasBacklog) {
            const backlog = await List.create({
                user: new Types.ObjectId(userId),
                type: 'tasks',
                title: 'Backlog',
                data: { tasks: [] },
                order: -1,
                group: 'System',
                isPinned: true,
                isSystem: true
            });
            lists.unshift(backlog);
        }

        return lists;
    }

    async updateList(userId: string, listId: string, params: UpdateListParams) {
        const list = await List.findOne({
            _id: new Types.ObjectId(listId),
            user: new Types.ObjectId(userId),
        });

        if (!list) {
            throw ApiError.notFound('List');
        }

        if (params.title !== undefined) list.title = params.title;
        if (params.data !== undefined) {
            list.data = params.data;
            // Mark the data field as modified since it's a Mixed type
            // This ensures Mongoose saves nested changes like completedAt timestamps
            list.markModified('data');
        }
        if (params.order !== undefined) list.order = params.order;
        if (params.group !== undefined) list.group = params.group;
        if (params.isPinned !== undefined) list.isPinned = params.isPinned;

        await list.save();
        return list;
    }

    async deleteList(userId: string, listId: string) {
        const list = await List.findOne({
            _id: new Types.ObjectId(listId),
            user: new Types.ObjectId(userId),
        });

        if (!list) {
            throw ApiError.notFound('List');
        }

        if (list.isSystem) {
            throw ApiError.badRequest('Cannot delete system lists');
        }

        await List.deleteOne({ _id: list._id });
    }

    async reorderLists(userId: string, listIds: string[]) {
        const bulkOps = listIds.map((id, index) => ({
            updateOne: {
                filter: { _id: new Types.ObjectId(id), user: new Types.ObjectId(userId) },
                update: { $set: { order: index } },
            },
        }));

        if (bulkOps.length > 0) {
            await List.bulkWrite(bulkOps);
        }
    }
}
