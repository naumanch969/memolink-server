import { CreateCollectionRequest, ICollection, UpdateCollectionRequest } from './collection.types';

export interface ICollectionService {
    createCollection(userId: string, data: CreateCollectionRequest): Promise<ICollection>;
    getCollectionById(collectionId: string, userId: string): Promise<ICollection>;
    getUserCollections(userId: string): Promise<ICollection[]>;
    updateCollection(collectionId: string, userId: string, data: UpdateCollectionRequest): Promise<ICollection>;
    deleteCollection(collectionId: string, userId: string): Promise<void>;
    incrementEntryCount(collectionId: string): Promise<void>;
    decrementEntryCount(collectionId: string): Promise<void>;
}
