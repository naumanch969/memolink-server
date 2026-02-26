import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.utils';
import { AuthenticatedRequest } from '../auth/auth.types';
import { collectionService } from './collection.service';
import { CreateCollectionRequest, UpdateCollectionRequest } from './collection.types';

export class CollectionController {
    static async createCollection(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const data: CreateCollectionRequest = req.body;
            const collection = await collectionService.createCollection(userId, data);
            ResponseHelper.created(res, collection, 'Collection created successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to create collection', 500, error);
        }
    }

    static async getCollectionById(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            const collection = await collectionService.getCollectionById(id, userId);
            ResponseHelper.success(res, collection, 'Collection retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve collection', 500, error);
        }
    }

    static async getUserCollections(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const collections = await collectionService.getUserCollections(userId);
            ResponseHelper.success(res, collections, 'Collections retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve collections', 500, error);
        }
    }

    static async updateCollection(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            const data: UpdateCollectionRequest = req.body;
            const collection = await collectionService.updateCollection(id, userId, data);
            ResponseHelper.success(res, collection, 'Collection updated successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to update collection', 500, error);
        }
    }

    static async deleteCollection(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            await collectionService.deleteCollection(id, userId);
            ResponseHelper.success(res, null, 'Collection deleted successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to delete collection', 500, error);
        }
    }
}

export default CollectionController;
