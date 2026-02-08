import { ClientSession, Types } from 'mongoose';
import { logger } from '../../config/logger';
import { EdgeType, GraphEdge, NodeType } from './edge.model';
import { IGraphEdge } from './graph.interface';
import Helpers from '../../shared/helpers';

/**
 * Strict Ontology: Defines which source nodes can have which relations to which target nodes.
 * This prevents semantic drift and invalid graph structures.
 */
const VALID_RELATIONS: Record<EdgeType, { from: NodeType[]; to: NodeType[] }> = {
    // Core User Relations
    [EdgeType.HAS_GOAL]: { from: [NodeType.USER], to: [NodeType.GOAL] },
    [EdgeType.HAS_TASK]: { from: [NodeType.USER], to: [NodeType.TASK, NodeType.REMINDER] },
    [EdgeType.KNOWS]: { from: [NodeType.USER], to: [NodeType.PERSON] },
    [EdgeType.INTERESTED_IN]: { from: [NodeType.USER], to: [NodeType.TOPIC, NodeType.PROJECT, NodeType.ORGANIZATION] },
    [EdgeType.MENTIONED_IN]: { from: [NodeType.PERSON, NodeType.PROJECT, NodeType.ORGANIZATION, NodeType.ENTITY, NodeType.USER], to: [NodeType.CONTEXT] },

    // Organizational & World Relations (Inter-linking)
    [EdgeType.WORKS_AT]: { from: [NodeType.PERSON], to: [NodeType.ORGANIZATION] },
    [EdgeType.CONTRIBUTES_TO]: { from: [NodeType.PERSON, NodeType.ORGANIZATION], to: [NodeType.PROJECT, NodeType.ORGANIZATION] },
    [EdgeType.MEMBER_OF]: { from: [NodeType.PERSON, NodeType.ORGANIZATION], to: [NodeType.ORGANIZATION, NodeType.PROJECT] },
    [EdgeType.PART_OF]: { from: [NodeType.PROJECT, NodeType.ORGANIZATION, NodeType.GOAL], to: [NodeType.PROJECT, NodeType.ORGANIZATION, NodeType.GOAL] },
    [EdgeType.OWNED_BY]: { from: [NodeType.PROJECT, NodeType.ORGANIZATION, NodeType.GOAL, NodeType.REMINDER, NodeType.TASK], to: [NodeType.USER, NodeType.PERSON, NodeType.ORGANIZATION] },
    [EdgeType.ASSOCIATED_WITH]: { from: [NodeType.PERSON, NodeType.PROJECT, NodeType.ORGANIZATION, NodeType.ENTITY, NodeType.USER], to: [NodeType.PERSON, NodeType.PROJECT, NodeType.ORGANIZATION, NodeType.ENTITY, NodeType.USER] },

    // Behavioral & Psychological (User Memory)
    [EdgeType.AVOIDS]: { from: [NodeType.USER], to: [NodeType.TASK, NodeType.GOAL, NodeType.PERSON, NodeType.PROJECT] },
    [EdgeType.NEGLECTS]: { from: [NodeType.USER], to: [NodeType.GOAL, NodeType.ROUTINE] },
    [EdgeType.STRUGGLES_WITH]: { from: [NodeType.USER, NodeType.PERSON], to: [NodeType.TOPIC, NodeType.TASK, NodeType.EMOTION, NodeType.PROJECT] },
    [EdgeType.CONSISTENT_IN]: { from: [NodeType.USER], to: [NodeType.ROUTINE, NodeType.TASK] },
    [EdgeType.TRIGGERS]: { from: [NodeType.TOPIC, NodeType.PERSON, NodeType.TASK, NodeType.CONTEXT, NodeType.PROJECT, NodeType.REMINDER], to: [NodeType.EMOTION, NodeType.GOAL] },
    [EdgeType.INFLUENCES]: { from: [NodeType.PERSON, NodeType.PROJECT, NodeType.ORGANIZATION, NodeType.ENTITY, NodeType.TOPIC], to: [NodeType.USER, NodeType.PERSON, NodeType.EMOTION] },

    // Dependency
    [EdgeType.BLOCKS]: { from: [NodeType.TASK, NodeType.GOAL], to: [NodeType.TASK, NodeType.GOAL] },
    [EdgeType.SUPPORTS]: { from: [NodeType.ROUTINE, NodeType.TASK, NodeType.GOAL, NodeType.PROJECT], to: [NodeType.GOAL, NodeType.PROJECT] },
    [EdgeType.REQUIRES]: { from: [NodeType.TASK, NodeType.GOAL, NodeType.PROJECT], to: [NodeType.TASK, NodeType.CONTEXT, NodeType.PROJECT] },
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

export class GraphService {

    /**
     * TAO Core: Creates an Association (Edge) and its Inverse.
     */
    async createAssociation(params: {
        fromId: string;
        fromType: NodeType;
        toId: string;
        toType: NodeType;
        relation: EdgeType;
        weight?: number;
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
                metadata: { ...params.metadata, isInverse: true }
            }, { session: options.session }).catch(err => logger.warn(`[GraphService] Failed to create inverse edge`, err));
        }

        return edge;
    }

    /**
     * Low-level: Creates or Updates a single directed edge.
     */
    async createEdge(params: {
        fromId: string;
        fromType: NodeType;
        toId: string;
        toType: NodeType;
        relation: EdgeType;
        weight?: number;
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
            const edge = await GraphEdge.findOneAndUpdate(
                {
                    "from.id": new Types.ObjectId(fromId),
                    "to.id": new Types.ObjectId(toId),
                    relation
                },
                {
                    $set: { "from.type": fromType, "to.type": toType, weight, metadata }
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
     * Removes an edge.
     */
    async removeEdge(fromId: string, toId: string, relation: EdgeType): Promise<void> {
        await GraphEdge.deleteOne({
            "from.id": new Types.ObjectId(fromId),
            "to.id": new Types.ObjectId(toId),
            relation
        });
    }

    /**
     * Finds all nodes connected FROM a source node.
     * e.g. "Get all Goals for User" -> getOutbounds(userId, HAS_GOAL)
     */
    async getOutbounds(fromId: string, relation?: EdgeType): Promise<IGraphEdge[]> {
        const query: any = { "from.id": new Types.ObjectId(fromId) };
        if (relation) query.relation = relation;

        return GraphEdge.find(query);
    }

    /**
     * Finds all nodes connected TO a target node.
     * e.g. "What triggers Anxiety?" -> getInbounds(anxietyId, TRIGGERS)
     */
    async getInbounds(toId: string, relation?: EdgeType): Promise<IGraphEdge[]> {
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
                "from.id": new Types.ObjectId(entityId),
                "metadata.isInverse": { $ne: true } // Prefer forward links for description
            })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean();

            if (edges.length === 0) return "";

            const relations = edges.map(edge => {
                const targetName = edge.metadata?.targetName || edge.metadata?.name || edge.to.type;
                return `${name} ${edge.relation.toLowerCase().replace(/_/g, ' ')} ${targetName}`;
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
    async getGraphSummary(userId: string): Promise<string> {
        try {
            // 1. Get all outbound edges from User
            const userEdges = await this.getOutbounds(userId);

            if (userEdges.length === 0) return "No graph data found.";

            const categories: Record<string, string[]> = {
                "Goals": [],
                "Patterns": [],
                "Top Interests": [],
            };

            userEdges.forEach(edge => {
                const title = edge.metadata?.title || 'Unknown';
                switch (edge.relation) {
                    case EdgeType.HAS_GOAL:
                        categories["Goals"].push(title);
                        break;
                    case EdgeType.AVOIDS:
                        categories["Patterns"].push(`Avoiding task: ${title}`);
                        break;
                    case EdgeType.STRUGGLES_WITH:
                        categories["Patterns"].push(`Struggling with: ${edge.to.type}`);
                        break;
                    case EdgeType.INTERESTED_IN:
                        categories["Top Interests"].push(edge.to.type === NodeType.TOPIC ? title : edge.to.type);
                        break;
                }
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
     * Gets entries where an entity was mentioned.
     */
    async getEntityInteractions(entityId: string, userId: string, options: { page?: number, limit?: number } = {}) {
        const { limit = 10, skip = 0 } = Helpers.getPaginationParams(options);

        // 1. Find MENTIONED_IN edges
        const edges = await GraphEdge.find({
            "from.id": new Types.ObjectId(entityId),
            relation: EdgeType.MENTIONED_IN
        })
            .sort({ "metadata.entryDate": -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await GraphEdge.countDocuments({
            "from.id": new Types.ObjectId(entityId),
            relation: EdgeType.MENTIONED_IN
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
}

export const graphService = new GraphService();
export default graphService;
