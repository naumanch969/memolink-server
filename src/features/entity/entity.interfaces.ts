import { NodeType } from '../graph/edge.model';
import { CreateEntityRequest, IKnowledgeEntity, UpdateEntityRequest } from "./entity.types";

export { NodeType };

export interface IEntityService {
    getEntityRegistry(userId: string): Promise<Record<string, string>>;
    createEntity(userId: string, data: CreateEntityRequest, options?: any): Promise<IKnowledgeEntity>;
    getEntityById(entityId: string, userId: string): Promise<IKnowledgeEntity>;
    getEntitiesByIds(entityIds: string[], userId: string): Promise<IKnowledgeEntity[]>;
    updateEntity(entityId: string, userId: string, data: UpdateEntityRequest, options?: any): Promise<IKnowledgeEntity>;
    deleteEntity(entityId: string, userId: string, options?: any): Promise<void>;
    listEntities(userId: string, options?: any): Promise<{ entities: any[]; total: number; page: number; totalPages: number }>;
    deleteUserData(userId: string): Promise<number>;
    findOrCreateEntity(userId: string, name: string, otype: NodeType, options?: any): Promise<IKnowledgeEntity>;
    migrateFromPersons(userId: string): Promise<void>;
}

