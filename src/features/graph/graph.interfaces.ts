import mongoose from "mongoose";
import { EdgeType } from "./edge.model";
import { IGraphEdge } from "./graph.types";

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