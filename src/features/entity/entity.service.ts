import { ClientSession, Types } from 'mongoose';
import { logger } from '../../config/logger';
import { redisConnection } from '../../config/redis';
import { createConflictError, createNotFoundError } from '../../core/middleware/errorHandler';
import { Helpers } from '../../shared/helpers';
import { NodeType } from '../graph/edge.model';
import { CreateEntityRequest, IKnowledgeEntity, UpdateEntityRequest } from './entity.interfaces';
import { KnowledgeEntity } from './entity.model';

export class EntityService {
    private getRedisKey(userId: string): string {
        return `agent:entities:registry:${userId}`;
    }

    /**
     * Registers an entity's name in Redis for fast lookup
     */
    private async registerInRedis(userId: string, entityId: string, name: string, aliases: string[] = []) {
        try {
            const key = this.getRedisKey(userId);
            const hash: Record<string, string> = {};
            hash[name.toLowerCase()] = entityId;
            aliases.forEach(a => { hash[a.toLowerCase()] = entityId; });

            await redisConnection.hmset(key, hash);
            logger.debug(`Entity ${name} (with ${aliases.length} aliases) registered in Redis for user ${userId}`);
        } catch (error) {
            logger.warn(`Failed to register entity ${name} in Redis`, error);
        }
    }

    private async unregisterInRedis(userId: string, name: string) {
        try {
            const key = this.getRedisKey(userId);
            await redisConnection.hdel(key, name.toLowerCase());
        } catch (error) {
            logger.warn(`Failed to unregister entity ${name} from Redis`, error);
        }
    }

    /**
     * Gets all entity names for a user (for the Agent's fast string match)
     */
    async getEntityRegistry(userId: string): Promise<Record<string, string>> {
        const key = this.getRedisKey(userId);
        return await redisConnection.hgetall(key);
    }

    async createEntity(userId: string, data: CreateEntityRequest, options: { session?: ClientSession } = {}): Promise<IKnowledgeEntity> {
        const existing = await KnowledgeEntity.findOne({
            userId,
            name: { $regex: new RegExp(`^${data.name.trim()}$`, 'i') },
            isDeleted: false
        }).session(options.session || null);

        if (existing) {
            throw createConflictError(`Entity with name "${data.name}" already exists.`);
        }

        const entity = new KnowledgeEntity({
            userId: new Types.ObjectId(userId),
            ...data
        });

        await entity.save({ session: options.session });

        // Note: Redis registration is outside the DB transaction. 
        // In a true ACID system, we'd trigger this via a Change Stream or an 'afterCommit' hook.
        // For migration safety, the caller should handle Redis sync.
        if (!options.session) {
            await this.registerInRedis(userId, entity._id.toString(), entity.name, entity.aliases);
        }

        logger.info(`Entity [${entity.otype}] created: ${entity.name}`, { userId, id: entity._id });
        return entity;
    }

    async getEntityById(entityId: string, userId: string): Promise<IKnowledgeEntity> {
        const entity = await KnowledgeEntity.findOne({ _id: entityId, userId, isDeleted: false });
        if (!entity) throw createNotFoundError('Entity');
        return entity;
    }

    async getEntitiesByIds(entityIds: string[], userId: string): Promise<IKnowledgeEntity[]> {
        return KnowledgeEntity.find({
            _id: { $in: entityIds.map(id => new Types.ObjectId(id)) },
            userId,
            isDeleted: false
        }).lean();
    }

    async updateEntity(entityId: string, userId: string, data: UpdateEntityRequest, options: { session?: ClientSession } = {}): Promise<IKnowledgeEntity> {
        const entity = await KnowledgeEntity.findOne({ _id: entityId, userId, isDeleted: false }).session(options.session || null);
        if (!entity) throw createNotFoundError('Entity');

        const oldName = entity.name;
        const oldAliases = [...(entity.aliases || [])];

        Object.assign(entity, data);
        await entity.save({ session: options.session });

        if (!options.session) {
            // Remove old name from Redis if changed
            if (data.name && data.name.toLowerCase() !== oldName.toLowerCase()) {
                await this.unregisterInRedis(userId, oldName);
            }
            // Update names/aliases in Redis
            await this.registerInRedis(userId, entity._id.toString(), entity.name, entity.aliases);
        }

        return entity;
    }

    async deleteEntity(entityId: string, userId: string, options: { session?: ClientSession } = {}): Promise<void> {
        const entity = await KnowledgeEntity.findOne({ _id: entityId, userId, isDeleted: false }).session(options.session || null);
        if (!entity) throw createNotFoundError('Entity');

        entity.isDeleted = true;
        entity.deletedAt = new Date();
        await entity.save({ session: options.session });

        if (!options.session) {
            await this.unregisterInRedis(userId, entity.name);
        }
    }

    async listEntities(userId: string, options: { otype?: NodeType, search?: string, limit?: number, page?: number, sortBy?: string, sortOrder?: 'asc' | 'desc' } = {}) {
        const { limit = 20, skip } = Helpers.getPaginationParams(options);

        // Determine sort
        let sort: Record<string, number> = { interactionCount: -1, updatedAt: -1 };
        if (options.sortBy === 'name') {
            sort = { name: options.sortOrder === 'desc' ? -1 : 1, updatedAt: -1 };
        } else if (options.sortBy === 'interactionCount') {
            sort = { interactionCount: options.sortOrder === 'asc' ? 1 : -1, updatedAt: -1 };
        }

        const query: any = { userId, isDeleted: false };
        if (options.otype) query.otype = options.otype;
        if (options.search) {
            const escapedSearch = options.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const searchRegex = new RegExp(escapedSearch, 'i');
            query.$or = [
                { name: { $regex: searchRegex } },
                { email: { $regex: searchRegex } },
                { phone: { $regex: searchRegex } },
                { company: { $regex: searchRegex } },
                { jobTitle: { $regex: searchRegex } },
                { tags: { $in: [searchRegex] } },
                { aliases: { $in: [searchRegex] } }
            ];
        }

        const [entities, total] = await Promise.all([
            KnowledgeEntity.find(query).sort(sort as any).skip(skip).limit(limit),
            KnowledgeEntity.countDocuments(query)
        ]);

        return {
            entities,
            total,
            page: options.page || 1,
            totalPages: Math.ceil(total / limit)
        };
    }

    async deleteUserData(userId: string): Promise<number> {
        const result = await KnowledgeEntity.deleteMany({ userId });
        const key = this.getRedisKey(userId);
        await redisConnection.del(key);
        logger.info(`Deleted ${result.deletedCount} knowledge entities for user ${userId}`);
        return result.deletedCount || 0;
    }

    /**
     * Find or Create logic (used by extraction workflows)
     */
    async findOrCreateEntity(userId: string, name: string, otype: NodeType, options: { session?: ClientSession } = {}): Promise<IKnowledgeEntity> {
        const entity = await KnowledgeEntity.findOne({
            userId,
            name: { $regex: new RegExp(`^${name}$`, 'i') }
        }).session(options.session || null);

        if (entity && entity.isDeleted) {
            entity.isDeleted = false;
            entity.deletedAt = undefined;
            await entity.save({ session: options.session });
            if (!options.session) {
                await this.registerInRedis(userId, entity._id.toString(), entity.name, entity.aliases);
            }
            return entity;
        }

        if (!entity) {
            return this.createEntity(userId, { name, otype }, { session: options.session }) as any;
        }

        return entity;
    }

    /**
     * Migration Helper: Seed entities from existing persons
     */
    async migrateFromPersons(userId: string) {
        const entities = await KnowledgeEntity.find({ userId, isDeleted: false });

        for (const e of entities) {
            try {
                await this.createEntity(userId, {
                    name: e.name,
                    otype: NodeType.PERSON,
                    email: e.email,
                    phone: e.phone,
                    avatar: e.avatar,
                    jobTitle: e.jobTitle,
                    company: e.company,
                    tags: e.tags,
                    summary: e.lastInteractionSummary,
                    // We can map more fields if needed
                });
            } catch (err) {
                // Ignore duplicates
            }
        }
    }
}

export const entityService = new EntityService();
export default entityService;
