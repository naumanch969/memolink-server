import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { EdgeType, GraphEdge, IGraphEdge, NodeType } from './edge.model';

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

        try {
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
                        metadata
                    }
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
}

export const graphService = new GraphService();
