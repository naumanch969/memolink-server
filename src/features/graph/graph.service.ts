import { ClientSession, Types } from 'mongoose';
import { logger } from '../../config/logger';
import Helpers from '../../shared/helpers';
import { EdgeStatus, EdgeType, GraphEdge, NodeType } from './edge.model';
import { IGraphService } from "./graph.interfaces";
import { IGraphEdge } from './graph.types';

/**
 * Strict Ontology: Defines which source nodes can have which relations to which target nodes.
 * This prevents semantic drift and invalid graph structures.
 */
const VALID_RELATIONS: Record<EdgeType, { from: NodeType[]; to: NodeType[] }> = {
    // Core User Relations
    [EdgeType.HAS_GOAL]: { from: [NodeType.USER], to: [NodeType.GOAL] },
    [EdgeType.HAS_TASK]: { from: [NodeType.USER], to: [NodeType.TASK, NodeType.REMINDER] },
    [EdgeType.KNOWS]: { from: [NodeType.USER, NodeType.PERSON, NodeType.ENTITY], to: [NodeType.PERSON, NodeType.ENTITY, NodeType.USER] },
    [EdgeType.INTERESTED_IN]: { from: [NodeType.USER, NodeType.PERSON, NodeType.ENTITY], to: [NodeType.TOPIC, NodeType.PROJECT, NodeType.ORGANIZATION, NodeType.ENTITY, NodeType.USER] },
    [EdgeType.MENTIONED_IN]: { from: [NodeType.PERSON, NodeType.PROJECT, NodeType.ORGANIZATION, NodeType.ENTITY, NodeType.USER], to: [NodeType.CONTEXT] },

    // Organizational & World Relations (Inter-linking)
    [EdgeType.WORKS_AT]: { from: [NodeType.PERSON, NodeType.ENTITY], to: [NodeType.ORGANIZATION, NodeType.ENTITY] },
    [EdgeType.CONTRIBUTES_TO]: { from: [NodeType.PERSON, NodeType.ORGANIZATION, NodeType.ENTITY, NodeType.USER], to: [NodeType.PROJECT, NodeType.ORGANIZATION, NodeType.ENTITY] },
    [EdgeType.MEMBER_OF]: { from: [NodeType.PERSON, NodeType.ORGANIZATION, NodeType.ENTITY], to: [NodeType.ORGANIZATION, NodeType.PROJECT, NodeType.ENTITY] },
    [EdgeType.PART_OF]: { from: [NodeType.PROJECT, NodeType.ORGANIZATION, NodeType.GOAL, NodeType.ENTITY], to: [NodeType.PROJECT, NodeType.ORGANIZATION, NodeType.GOAL, NodeType.ENTITY] },
    [EdgeType.OWNED_BY]: { from: [NodeType.PROJECT, NodeType.ORGANIZATION, NodeType.GOAL, NodeType.REMINDER, NodeType.TASK, NodeType.ENTITY], to: [NodeType.USER, NodeType.PERSON, NodeType.ORGANIZATION, NodeType.ENTITY] },
    [EdgeType.ASSOCIATED_WITH]: { from: [NodeType.PERSON, NodeType.PROJECT, NodeType.ORGANIZATION, NodeType.ENTITY, NodeType.USER, NodeType.TOPIC], to: [NodeType.PERSON, NodeType.PROJECT, NodeType.ORGANIZATION, NodeType.ENTITY, NodeType.USER, NodeType.TOPIC] },

    // Behavioral & Psychological (User Memory)
    [EdgeType.AVOIDS]: { from: [NodeType.USER], to: [NodeType.TASK, NodeType.GOAL, NodeType.PERSON, NodeType.PROJECT, NodeType.ENTITY] },
    [EdgeType.NEGLECTS]: { from: [NodeType.USER], to: [NodeType.GOAL] },
    [EdgeType.STRUGGLES_WITH]: { from: [NodeType.USER, NodeType.PERSON], to: [NodeType.TOPIC, NodeType.TASK, NodeType.EMOTION, NodeType.PROJECT, NodeType.ENTITY] },
    [EdgeType.CONSISTENT_IN]: { from: [NodeType.USER], to: [NodeType.TASK] },
    [EdgeType.TRIGGERS]: { from: [NodeType.TOPIC, NodeType.PERSON, NodeType.TASK, NodeType.CONTEXT, NodeType.PROJECT, NodeType.REMINDER, NodeType.ENTITY], to: [NodeType.EMOTION, NodeType.GOAL] },
    [EdgeType.INFLUENCES]: { from: [NodeType.PERSON, NodeType.PROJECT, NodeType.ORGANIZATION, NodeType.ENTITY, NodeType.TOPIC], to: [NodeType.USER, NodeType.PERSON, NodeType.EMOTION] },

    // Dependency
    [EdgeType.BLOCKS]: { from: [NodeType.TASK, NodeType.GOAL, NodeType.ENTITY], to: [NodeType.TASK, NodeType.GOAL, NodeType.ENTITY] },
    [EdgeType.SUPPORTS]: { from: [NodeType.TASK, NodeType.GOAL, NodeType.PROJECT, NodeType.ENTITY], to: [NodeType.GOAL, NodeType.PROJECT, NodeType.ENTITY] },
    [EdgeType.REQUIRES]: { from: [NodeType.TASK, NodeType.GOAL, NodeType.PROJECT, NodeType.ENTITY], to: [NodeType.TASK, NodeType.CONTEXT, NodeType.PROJECT, NodeType.ENTITY] },
};

/**
 * Inverse mapping for bi-directional consistency
 */
const INVERSE_RELATIONS: Partial<Record<EdgeType, EdgeType>> = {
    [EdgeType.WORKS_AT]: EdgeType.ASSOCIATED_WITH,
    [EdgeType.CONTRIBUTES_TO]: EdgeType.ASSOCIATED_WITH,
    [EdgeType.MEMBER_OF]: EdgeType.ASSOCIATED_WITH,
    [EdgeType.PART_OF]: EdgeType.PART_OF,
    [EdgeType.OWNED_BY]: EdgeType.ASSOCIATED_WITH, // Should ideally be inverse of OWNS/HAS, but we use OWNED_BY for targets
    [EdgeType.KNOWS]: EdgeType.KNOWS,
    [EdgeType.ASSOCIATED_WITH]: EdgeType.ASSOCIATED_WITH,
    [EdgeType.HAS_GOAL]: EdgeType.OWNED_BY,
    [EdgeType.HAS_TASK]: EdgeType.OWNED_BY,
};

export class GraphService implements IGraphService {

    /**
     * TAO Core: Creates an Association (Edge) and its Inverse.
     */
    async createAssociation(params: {
        fromId: string | Types.ObjectId | Types.ObjectId;
        fromType: NodeType;
        toId: string | Types.ObjectId | Types.ObjectId;
        toType: NodeType;
        relation: EdgeType;
        weight?: number;
        sourceEntryId?: string;
        metadata?: any;
    }, options: { session?: ClientSession } = {}): Promise<IGraphEdge> {
        // 1. Create the Forward Edge
        const edge = await this.createEdge(params, { session: options.session });

        // 2. Create the Inverse Edge if defined
        const inverseRelation = INVERSE_RELATIONS[params.relation];
        if (inverseRelation) {
            await this.createEdge({
                fromId: params.toId,
                fromType: params.toType,
                toId: params.fromId,
                toType: params.fromType,
                relation: inverseRelation,
                weight: params.weight,
                sourceEntryId: params.sourceEntryId,
                metadata: { ...params.metadata, isInverse: true }
            }, { session: options.session }).catch(err => logger.warn(`[GraphService] Failed to create inverse edge`, err));
        }

        return edge;
    }

    /**
     * Low-level: Creates or Updates a single directed edge.
     */
    async createEdge(params: {
        fromId: string | Types.ObjectId;
        fromType: NodeType;
        toId: string | Types.ObjectId;
        toType: NodeType;
        relation: EdgeType;
        weight?: number;
        sourceEntryId?: string;
        metadata?: any;
    }, options: { session?: ClientSession } = {}): Promise<IGraphEdge> {
        const { fromId, fromType, toId, toType, relation, weight = 1.0, metadata = {} } = params;

        // Ontological Validation
        const rule = VALID_RELATIONS[relation];
        if (!rule) throw new Error(`[GraphService] Unsupported relation type: ${relation}`);
        if (!rule.from.includes(fromType) || !rule.to.includes(toType)) {
            throw new Error(`Invalid relationship: ${fromType} -[${relation}]-> ${toType}`);
        }

        try {
            // Conflict Detection: If it exists and was REFUTED, mark as PROPOSED
            const existing = await GraphEdge.findOne({
                "from.id": new Types.ObjectId(fromId),
                "to.id": new Types.ObjectId(toId),
                relation
            }).session(options.session || null);

            let targetStatus = EdgeStatus.ACTIVE;
            if (existing) {
                if (existing.status === EdgeStatus.REFUTED) {
                    targetStatus = EdgeStatus.PROPOSED;
                    logger.info(`[GraphService] Conflict detected for ${relation}. Edge was previously refuted. Marking as PROPOSED.`);
                } else {
                    targetStatus = existing.status; // Preserve PROPOSED or ACTIVE
                }
            }

            const edge = await GraphEdge.findOneAndUpdate(
                {
                    "from.id": new Types.ObjectId(fromId),
                    "to.id": new Types.ObjectId(toId),
                    relation
                },
                {
                    $set: {
                        "from.type": fromType,
                        "to.type": toType,
                        weight,
                        metadata: { ...metadata, lastSeenAt: new Date() },
                        sourceEntryId: params.sourceEntryId ? new Types.ObjectId(params.sourceEntryId) : undefined,
                        status: targetStatus
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true, session: options.session || null }
            );

            return edge;
        } catch (error) {
            logger.error(`[GraphService] Failed to create edge ${fromType}->${relation}->${toType}`, error);
            throw error;
        }
    }

    /**
     * Retrieves all relationships flagged for user review.
     */
    async getPendingProposals(userId: string): Promise<IGraphEdge[]> {
        // Find edges connected to human-centered nodes for this user
        // Simplified for now: find all PROPOSED edges
        return GraphEdge.find({ status: EdgeStatus.PROPOSED }).populate('sourceEntryId');
    }

    /**
     * Resolves a conflict by either accepting the new fact or re-affirming the refutation.
     */
    async resolveProposal(proposalId: string, action: 'accept' | 'reject'): Promise<void> {
        if (action === 'accept') {
            await GraphEdge.findByIdAndUpdate(proposalId, {
                $set: { status: EdgeStatus.ACTIVE, refutedAt: undefined }
            });
            logger.info(`Proposal ${proposalId} accepted by user.`);
        } else {
            await GraphEdge.findByIdAndUpdate(proposalId, {
                $set: { status: EdgeStatus.REFUTED, refutedAt: new Date() }
            });
            logger.info(`Proposal ${proposalId} rejected by user (re-refuted).`);
        }
    }

    /**
     * Removes an edge by its MongoDB ID.
     */
    async removeEdgeById(edgeId: string): Promise<void> {
        await GraphEdge.findByIdAndDelete(edgeId);
    }

    /**
     * Removes an edge by semantic lookup.
     */
    async removeEdge(fromId: string | Types.ObjectId, toId: string | Types.ObjectId, relation: EdgeType): Promise<void> {
        await GraphEdge.deleteMany({
            "from.id": new Types.ObjectId(fromId),
            "to.id": new Types.ObjectId(toId),
            relation
        });
    }

    /**
     * Refutation: Marks an edge as incorrect/rejected by the user.
     * This preserves the edge but hides it from active reasoning.
     */
    async refuteEdge(edgeId: string): Promise<void> {
        await GraphEdge.findByIdAndUpdate(edgeId, {
            $set: {
                status: EdgeStatus.REFUTED,
                refutedAt: new Date()
            }
        });
        logger.info(`Edge ${edgeId} refuted by user.`);
    }

    /**
     * Restores a previously refuted edge to ACTIVE status.
     */
    async unrefuteEdge(edgeId: string): Promise<void> {
        await GraphEdge.findByIdAndUpdate(edgeId, {
            $set: {
                status: EdgeStatus.ACTIVE,
                refutedAt: undefined
            }
        });
    }

    /**
     * Removes all edges associated with a node (from or to).
     * Used for cascading deletions.
     */
    async removeNodeEdges(nodeId: string): Promise<void> {
        await GraphEdge.deleteMany({
            $or: [
                { "from.id": new Types.ObjectId(nodeId) },
                { "to.id": new Types.ObjectId(nodeId) }
            ]
        });
    }

    /**
     * Finds all nodes connected FROM a source node.
     * e.g. "Get all Goals for User" -> getOutbounds(userId, HAS_GOAL)
     */
    async getOutbounds(fromId: string | Types.ObjectId, relation?: EdgeType): Promise<IGraphEdge[]> {
        const query: any = { "from.id": new Types.ObjectId(fromId) };
        if (relation) query.relation = relation;

        return GraphEdge.find(query);
    }

    /**
     * Finds all nodes connected TO a target node.
     * e.g. "What triggers Anxiety?" -> getInbounds(anxietyId, TRIGGERS)
     */
    async getInbounds(toId: string | Types.ObjectId, relation?: EdgeType): Promise<IGraphEdge[]> {
        const query: any = { "to.id": new Types.ObjectId(toId) };
        if (relation) query.relation = relation;
        return GraphEdge.find(query);
    }

    /**
     * Retrieves the structural context (1-hop relationships) for a list of entities.
     * Used for Agent prompt injection (High Performance).
     */
    async getEntitiesContext(entities: Array<{ id: string, name: string }>): Promise<string[]> {
        if (entities.length === 0) return [];

        const contextResults = await Promise.all(entities.map(async (e) => {
            return this.getEntityContext(e.id, e.name);
        }));

        return contextResults.filter(c => c !== "");
    }

    /**
     * TAO Retrieval: Gets a textual summary of an entity's 1-hop associations.
     * Sorted by time to prioritize recent associations (Time-Locality).
     */
    async getEntityContext(entityId: string, name: string): Promise<string> {
        try {
            const edges = await GraphEdge.find({
                $or: [
                    { "from.id": new Types.ObjectId(entityId) },
                    { "to.id": new Types.ObjectId(entityId) }
                ],
                "metadata.isInverse": { $ne: true },
                status: EdgeStatus.ACTIVE // Only include active facts in context
            })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean();

            if (edges.length === 0) return "";

            const relations = edges.map(edge => {
                const isSource = edge.from.id.toString() === entityId;
                if (isSource) {
                    const targetName = edge.metadata?.targetName || edge.metadata?.name || edge.to.type;
                    return `${name} ${edge.relation.toLowerCase().replace(/_/g, ' ')} ${targetName}`;
                } else {
                    const sourceName = edge.metadata?.sourceName || edge.metadata?.name || edge.from.type;
                    return `${sourceName} ${edge.relation.toLowerCase().replace(/_/g, ' ')} ${name}`;
                }
            });

            return `ENTITY: ${name}\nGraph: ${relations.join(', ')}`;
        } catch (error) {
            return "";
        }
    }

    /**
     * Returns a high-level textual summary of the user's graph state.
     * Used for Agent Context.
     */
    async getGraphSummary(userId: string | Types.ObjectId): Promise<string> {
        try {
            // 1. Get all outbound edges from User (only ACTIVE ones)
            const query: any = { "from.id": new Types.ObjectId(userId), status: EdgeStatus.ACTIVE };
            const userEdges = await GraphEdge.find(query);

            if (userEdges.length === 0) return "No graph data found.";

            const categories: Record<string, string[]> = {
                "Goals": [],
                "People & Connections": [],
                "Top Interests": [],
                "Patterns": [],
            };

            const peopleIds = userEdges
                .filter(e => e.relation === EdgeType.KNOWS)
                .map(e => e.to.id);

            // Fetch 2-hop relations for known people (e.g., where they work)
            const secondHopEdges = await GraphEdge.find({
                "from.id": { $in: peopleIds },
                relation: { $in: [EdgeType.WORKS_AT, EdgeType.MEMBER_OF, EdgeType.CONTRIBUTES_TO, EdgeType.PART_OF] },
                status: EdgeStatus.ACTIVE
            }).lean();

            userEdges.forEach(edge => {
                const title = edge.metadata?.title || edge.metadata?.name || 'Unknown';
                const targetType = edge.to.type;

                switch (edge.relation) {
                    case EdgeType.HAS_GOAL:
                        categories["Goals"].push(title);
                        break;
                    case EdgeType.KNOWS:
                        categories["People & Connections"].push(title);
                        break;
                    case EdgeType.AVOIDS:
                        categories["Patterns"].push(`Avoiding task: ${title}`);
                        break;
                    case EdgeType.STRUGGLES_WITH:
                        categories["Patterns"].push(`Struggling with: ${targetType}`);
                        break;
                    case EdgeType.INTERESTED_IN:
                        categories["Top Interests"].push(`${targetType}: ${title}`);
                        break;
                }
            });

            // Add second-hop context
            secondHopEdges.forEach(edge => {
                const sourceName = edge.metadata?.sourceName || edge.metadata?.name || 'Someone';
                const targetName = edge.metadata?.targetName || edge.metadata?.name || 'Organization';
                categories["People & Connections"].push(`${sourceName} ${edge.relation.toLowerCase().replace(/_/g, ' ')} ${targetName}`);
            });

            return Object.entries(categories)
                .filter(([_, items]) => items.length > 0)
                .map(([cat, items]) => `${cat}:\n${items.map(i => `- ${i}`).join('\n')}`)
                .join('\n\n');
        } catch (error) {
            logger.error(`[GraphService] Failed to get summary for ${userId}`, error);
            return "Error retrieving graph context.";
        }
    }

    /**
     * Negative Context: Fetches all relationships previously rejected by the user.
     * Prevents the AI from repeating mistakes.
     */
    async getRefutationContext(userId: string): Promise<string[]> {
        const refutedEdges = await GraphEdge.find({
            status: EdgeStatus.REFUTED,
            $or: [
                { "from.id": new Types.ObjectId(userId) },
                { "to.id": new Types.ObjectId(userId) }
            ]
        }).lean();

        return refutedEdges.map(edge => {
            const sourceName = edge.metadata?.sourceName || edge.metadata?.name || 'Unknown';
            const targetName = edge.metadata?.targetName || edge.metadata?.name || 'Unknown';
            return `${sourceName} -[${edge.relation}]-> ${targetName}`;
        });
    }

    /**
     * Gets entries where an entity was mentioned.
     */
    async getEntityInteractions(entityId: string, userId: string, options: { page?: number, limit?: number } = {}) {
        const { limit = 10, skip = 0 } = Helpers.getPaginationParams(options);

        // 1. Find MENTIONED_IN edges
        const edges = await GraphEdge.find({
            "from.id": new Types.ObjectId(entityId),
            relation: EdgeType.MENTIONED_IN,
            status: EdgeStatus.ACTIVE
        })
            .sort({ "metadata.entryDate": -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await GraphEdge.countDocuments({
            "from.id": new Types.ObjectId(entityId),
            relation: EdgeType.MENTIONED_IN,
            status: EdgeStatus.ACTIVE
        });

        const entryIds = edges.map(edge => edge.to.id);

        // 2. Fetch Entry details
        const { default: Entry } = await import('../entry/entry.model');
        const entries = await Entry.find({
            _id: { $in: entryIds },
            userId: new Types.ObjectId(userId)
        }).sort({ date: -1 }).lean();

        return {
            entries,
            total,
            page: options.page || 1,
            limit: options.limit || 10,
            totalPages: Math.ceil(total / limit)
        };
    }

    /**
     * Self-Healing: Finds entities that belong to the user but have no direct graph connection.
     * Creates default 'Ego-Edges' to ensure they are reachable.
     */
    async repairOrphanedEntities(userId: string): Promise<{ repairedCount: number, entities: string[] }> {
        // 1. Get all IDs the user is directly connected to
        const userEdges = await GraphEdge.find({
            "from.id": new Types.ObjectId(userId),
            status: EdgeStatus.ACTIVE
        }).select('to.id').lean();

        const connectedIds = new Set(userEdges.map(e => e.to.id.toString()));

        // 2. Find Entities that are NOT in this set
        const { KnowledgeEntity } = await import('../entity/entity.model');
        const orphans = await KnowledgeEntity.find({
            userId: new Types.ObjectId(userId),
            _id: { $nin: Array.from(connectedIds) },
            isDeleted: false
        }).select('_id name otype').lean();

        if (orphans.length === 0) {
            return { repairedCount: 0, entities: [] };
        }

        logger.info(`[GraphService] Found ${orphans.length} orphaned entities for user ${userId}. Repairing...`);

        // 3. Create missing edges
        const repairs = [];
        for (const orphan of orphans) {
            const relation = orphan.otype === NodeType.PERSON ? EdgeType.KNOWS : EdgeType.INTERESTED_IN;

            // We use createEdge directly to avoid overhead, or createAssociation to be safe
            // Let's use createAssociation to ensure Inverse edges (KNOWS is distinctive)
            repairs.push(this.createAssociation({
                fromId: userId,
                fromType: NodeType.USER,
                toId: orphan._id.toString(),
                toType: orphan.otype as NodeType,
                relation,
                metadata: {
                    source: 'repair-script',
                    repairedAt: new Date(),
                    name: orphan.name
                }
            }));
        }

        await Promise.allSettled(repairs);

        return {
            repairedCount: orphans.length,
            entities: orphans.map(o => o.name)
        };
    }
}

export const graphService = new GraphService();
export default graphService;
