import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { ApiError } from '../../core/errors/api.error';
import { Helpers } from '../../shared/helpers';
import { ICollectionService } from './collection.interfaces';
import { Collection } from './collection.model';
import { CreateCollectionRequest, ICollection, UpdateCollectionRequest } from './collection.types';

export class CollectionService implements ICollectionService {

    async createCollection(userId: string, data: CreateCollectionRequest): Promise<ICollection> {
        try {
            const existing = await Collection.findOne({ userId, name: data.name.trim() });
            if (existing) throw ApiError.conflict('Collection with this name already exists');

            const collection = new Collection({
                userId: new Types.ObjectId(userId),
                ...data,
                color: data.color || Helpers.generateRandomHexColor(),
            });

            await collection.save();
            logger.info('Collection created', { collectionId: collection._id, userId });
            return collection;
        } catch (error) {
            logger.error('Collection creation failed:', error);
            throw error;
        }
    }

    async getCollectionById(collectionId: string, userId: string): Promise<ICollection> {
        const collection = await Collection.findOne({ _id: collectionId, userId });
        if (!collection) throw ApiError.notFound('Collection');
        return collection;
    }

    async getUserCollections(userId: string): Promise<ICollection[]> {
        return Collection.find({ userId }).sort({ createdAt: -1 });
    }

    async updateCollection(collectionId: string, userId: string, data: UpdateCollectionRequest): Promise<ICollection> {
        try {
            const collection = await Collection.findOneAndUpdate(
                { _id: collectionId, userId },
                { $set: data },
                { new: true, runValidators: true }
            );
            if (!collection) throw ApiError.notFound('Collection');

            logger.info('Collection updated', { collectionId, userId });
            return collection;
        } catch (error) {
            logger.error('Collection update failed:', error);
            throw error;
        }
    }

    async deleteCollection(collectionId: string, userId: string): Promise<void> {
        try {
            const collection = await Collection.findOneAndDelete({ _id: collectionId, userId });
            if (!collection) throw ApiError.notFound('Collection');

            // Cleanup: remove collectionId from all entries previously in this collection
            // We use the model directly to avoid circular service dependencies
            const { Entry } = await import('../entry/entry.model');
            await Entry.updateMany(
                { userId: new Types.ObjectId(userId), collectionId },
                { $unset: { collectionId: 1 } }
            );

            logger.info('Collection deleted and entries unlinked', { collectionId, userId });
        } catch (error) {
            logger.error('Collection deletion failed:', error);
            throw error;
        }
    }

    async incrementEntryCount(collectionId: string): Promise<void> {
        await Collection.updateOne({ _id: collectionId }, { $inc: { entryCount: 1 } });
    }

    async decrementEntryCount(collectionId: string): Promise<void> {
        await Collection.updateOne(
            { _id: collectionId, entryCount: { $gt: 0 } },
            { $inc: { entryCount: -1 } }
        );
    }

    async deleteUserData(userId: string): Promise<number> {
        const result = await Collection.deleteMany({ userId });
        logger.info(`Deleted ${result.deletedCount} collections for user ${userId}`);
        return result.deletedCount || 0;
    }
}

export const collectionService = new CollectionService();
export default collectionService;
