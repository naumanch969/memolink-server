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