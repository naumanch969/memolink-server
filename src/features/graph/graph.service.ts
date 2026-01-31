import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { EdgeType, GraphEdge, NodeType } from './edge.model';
import { IGraphEdge } from './graph.interface';

/**
 * Strict Ontology: Defines which source nodes can have which relations to which target nodes.
 * This prevents semantic drift and invalid graph structures.
 */
const VALID_RELATIONS: Record<EdgeType, { from: NodeType[]; to: NodeType[] }> = {
    [EdgeType.HAS_GOAL]: { from: [NodeType.USER], to: [NodeType.GOAL] },
    [EdgeType.HAS_TASK]: { from: [NodeType.USER], to: [NodeType.TASK] },
    [EdgeType.KNOWS]: { from: [NodeType.USER], to: [NodeType.PERSON] },
    [EdgeType.INTERESTED_IN]: { from: [NodeType.USER], to: [NodeType.TOPIC] },
    [EdgeType.AVOIDS]: { from: [NodeType.USER], to: [NodeType.TASK, NodeType.GOAL, NodeType.PERSON] },
    [EdgeType.NEGLECTS]: { from: [NodeType.USER], to: [NodeType.GOAL, NodeType.ROUTINE] },
    [EdgeType.STRUGGLES_WITH]: { from: [NodeType.USER], to: [NodeType.TOPIC, NodeType.TASK, NodeType.EMOTION] },
    [EdgeType.CONSISTENT_IN]: { from: [NodeType.USER], to: [NodeType.ROUTINE, NodeType.TASK] },
    [EdgeType.TRIGGERS]: { from: [NodeType.TOPIC, NodeType.PERSON, NodeType.TASK, NodeType.CONTEXT], to: [NodeType.EMOTION] },
    [EdgeType.BLOCKS]: { from: [NodeType.TASK, NodeType.GOAL], to: [NodeType.TASK, NodeType.GOAL] },
    [EdgeType.SUPPORTS]: { from: [NodeType.ROUTINE, NodeType.TASK, NodeType.GOAL], to: [NodeType.GOAL] },
    [EdgeType.REQUIRES]: { from: [NodeType.TASK, NodeType.GOAL], to: [NodeType.TASK, NodeType.CONTEXT] },
};

export class GraphService {

    /**
     * Creates or Updates a directed edge in the graph.
     */
    async createEdge(params: {
        fromId: string;
        fromType: NodeType;
        toId: string;
        toType: NodeType;
        relation: EdgeType;
        weight?: number;
        metadata?: any;
    }): Promise<IGraphEdge> {
        const { fromId, fromType, toId, toType, relation, weight = 1.0, metadata = {} } = params;

        // 1. Ontological Validation (Robustness against bloat/wrong info)
        const rule = VALID_RELATIONS[relation];
        if (!rule) {
            throw new Error(`[GraphService] Unsupported relation type: ${relation}`);
        }

        if (!rule.from.includes(fromType) || !rule.to.includes(toType)) {
            const errorMsg = `Invalid relationship: ${fromType} -[${relation}]-> ${toType}`;
            logger.warn(`[GraphService] Validation failed: ${errorMsg}`);
            throw new Error(errorMsg);
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
                { upsert: true, new: true, setDefaultsOnInsert: true }
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
}

export const graphService = new GraphService();
