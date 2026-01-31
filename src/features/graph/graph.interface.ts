import mongoose, { Document } from "mongoose";
import { EdgeType, NodeType } from "./edge.model";

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
    weight: number;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}