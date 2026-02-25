import { Response } from 'express';
import { ResponseHelper } from '../../core/utils/response.utils';
import { Helpers } from '../../shared/helpers';
import { AuthenticatedRequest } from '../auth/auth.types';
import { EdgeType, GraphEdge, NodeType } from '../graph/edge.model';
import { graphService } from '../graph/graph.service';
import { entityService } from './entity.service';
import { CreateEntityRequest, UpdateEntityRequest } from './entity.types';

export class EntityController {
    static async createEntity(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const entityData: CreateEntityRequest = req.body;
            const entity = await entityService.createEntity(userId, entityData);

            ResponseHelper.created(res, entity, 'Entity created successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to create entity', 500, error);
        }
    }

    static async getEntityById(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            const entity = await entityService.getEntityById(id, userId);

            ResponseHelper.success(res, entity, 'Entity retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve entity', 500, error);
        }
    }

    static async getUserEntities(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { page, limit, search, sortBy, sortOrder, otype } = req.query;
            const { page: pageNum, limit: limitNum } = Helpers.getPaginationParams({ page, limit });

            const result = await entityService.listEntities(userId, {
                page: pageNum,
                limit: limitNum,
                search: search as string,
                otype: otype as NodeType,
                sortBy: sortBy as string,
                sortOrder: sortOrder as 'asc' | 'desc'
            });

            ResponseHelper.paginated(res, result.entities, {
                page: result.page,
                limit: limitNum,
                total: result.total,
                totalPages: result.totalPages,
            }, 'Entities retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve entities', 500, error);
        }
    }

    static async updateEntity(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            const updateData: UpdateEntityRequest = req.body;
            const entity = await entityService.updateEntity(id, userId, updateData);

            ResponseHelper.success(res, entity, 'Entity updated successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to update entity', 500, error);
        }
    }

    static async deleteEntity(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            await entityService.deleteEntity(id, userId);

            ResponseHelper.success(res, null, 'Entity deleted successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to delete entity', 500, error);
        }
    }

    static async searchEntities(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { q, otype } = req.query;

            if (!q || typeof q !== 'string') {
                ResponseHelper.badRequest(res, 'Query parameter "q" is required');
                return;
            }

            const result = await entityService.listEntities(userId, {
                search: q,
                otype: otype as NodeType,
                limit: 50
            });

            ResponseHelper.success(res, result.entities, 'Entities searched successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to search entities', 500, error);
        }
    }

    static async getEntityInteractions(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { id } = req.params;
            const { page, limit } = req.query;
            const { page: pageNum, limit: limitNum } = Helpers.getPaginationParams({ page, limit });

            // This would typically use the GraphService to find MENTIONED_IN edges to entries
            const { graphService } = await import('../graph/graph.service');
            const result = await graphService.getEntityInteractions(id, userId, { page: pageNum, limit: limitNum });

            ResponseHelper.paginated(res, result.entries, {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages,
            }, 'Entity interactions retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve entity interactions', 500, error);
        }
    }

    static async getGraph(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { otype } = req.query;

            // 1. Get all Entities (Nodes) for the user
            const entitiesResult = await entityService.listEntities(userId, {
                limit: 1000,
                otype: otype as NodeType
            });

            const entityIds = entitiesResult.entities.map(e => e._id);

            // 2. Find all inter-entity links in the graph_edges collection
            const linksData = await GraphEdge.find({
                "from.id": { $in: entityIds },
                "to.id": { $in: entityIds },
                "metadata.isInverse": { $ne: true }
            }).lean();

            const nodes = entitiesResult.entities.map(e => ({
                id: e._id.toString(),
                name: e.name,
                img: e.avatar,
                group: e.tags && e.tags.length > 0 ? e.tags[0] : (e.otype || 'default')
            }));

            const links = linksData.map(l => ({
                source: l.from.id.toString(),
                target: l.to.id.toString(),
                type: l.relation,
                strength: l.weight * 5
            }));

            ResponseHelper.success(res, { nodes, links }, 'Graph data retrieved successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to retrieve graph data', 500, error);
        }
    }

    static async createRelation(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user!._id.toString();
            const { sourceId, targetId, type, strength } = req.body;

            // Validation: Ensure entities belong to user
            const [source, target] = await Promise.all([
                entityService.getEntityById(sourceId, userId),
                entityService.getEntityById(targetId, userId)
            ]);

            const relation = await graphService.createAssociation({
                fromId: sourceId,
                fromType: source.otype || NodeType.ENTITY,
                toId: targetId,
                toType: target.otype || NodeType.ENTITY,
                relation: type as EdgeType || EdgeType.ASSOCIATED_WITH,
                weight: (strength || 5) / 10,
                metadata: { createdManually: true }
            });

            ResponseHelper.created(res, relation, 'Relation created successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to create relation', 500, error);
        }
    }

    static async deleteRelation(req: AuthenticatedRequest, res: Response) {
        try {
            const { sourceId, targetId, type } = req.body;
            await graphService.removeEdge(sourceId, targetId, type as EdgeType);
            ResponseHelper.success(res, null, 'Relation deleted successfully');
        } catch (error) {
            ResponseHelper.error(res, 'Failed to delete relation', 500, error);
        }
    }
}

export default EntityController;
