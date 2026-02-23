import mongoose, { Document } from "mongoose";
import { EdgeStatus, EdgeType, NodeType } from "./edge.model";

export interface IGraphEdge extends Document {
    from: {
        id: mongoose.Types.ObjectId;
        type: NodeType;
    };
    to: {
        id: mongoose.Types.ObjectId;
        type: NodeType;
    };
    relation: EdgeType;
    status: EdgeStatus;
    weight: number;
    sourceEntryId?: mongoose.Types.ObjectId;
    refutedAt?: Date;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface IGraphService {
    createAssociation(params: any, options?: any): Promise<IGraphEdge>;
    createEdge(params: any, options?: any): Promise<IGraphEdge>;
    getPendingProposals(userId: string): Promise<IGraphEdge[]>;
    resolveProposal(proposalId: string, action: 'accept' | 'reject'): Promise<void>;
    removeEdgeById(edgeId: string): Promise<void>;
    removeEdge(fromId: string | mongoose.Types.ObjectId, toId: string | mongoose.Types.ObjectId, relation: EdgeType): Promise<void>;
    refuteEdge(edgeId: string): Promise<void>;
    unrefuteEdge(edgeId: string): Promise<void>;
    removeNodeEdges(nodeId: string): Promise<void>;
    getOutbounds(fromId: string | mongoose.Types.ObjectId, relation?: EdgeType): Promise<IGraphEdge[]>;
    getInbounds(toId: string | mongoose.Types.ObjectId, relation?: EdgeType): Promise<IGraphEdge[]>;
    getEntitiesContext(entities: Array<{ id: string, name: string }>): Promise<string[]>;
    getEntityContext(entityId: string, name: string): Promise<string>;
    getGraphSummary(userId: string | mongoose.Types.ObjectId): Promise<string>;
    getRefutationContext(userId: string): Promise<string[]>;
    getEntityInteractions(entityId: string, userId: string, options?: any): Promise<any>;
    repairOrphanedEntities(userId: string): Promise<any>;
}