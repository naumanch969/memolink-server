import mongoose, { Document, Schema } from 'mongoose';
import { IGraphEdge } from './graph.interface';

export enum EdgeType {
    // Core
    HAS_GOAL = 'HAS_GOAL',
    HAS_TASK = 'HAS_TASK',
    KNOWS = 'KNOWS',
    INTERESTED_IN = 'INTERESTED_IN',

    // Behavioral
    AVOIDS = 'AVOIDS',
    NEGLECTS = 'NEGLECTS',
    STRUGGLES_WITH = 'STRUGGLES_WITH',
    CONSISTENT_IN = 'CONSISTENT_IN',
    TRIGGERS = 'TRIGGERS',

    // Dependency
    BLOCKS = 'BLOCKS',
    SUPPORTS = 'SUPPORTS',
    REQUIRES = 'REQUIRES'
}

export enum NodeType {
    USER = 'User',
    GOAL = 'Goal',
    TASK = 'Task',
    ROUTINE = 'Routine',
    PERSON = 'Person',
    TOPIC = 'Topic',
    EMOTION = 'Emotion',
    CONTEXT = 'Context',
    REMINDER = 'Reminder' // Aliased to Task usually
}

const GraphEdgeSchema = new Schema<IGraphEdge>({
    from: {
        id: { type: Schema.Types.ObjectId, required: true, refPath: 'from.type' },
        type: { type: String, enum: Object.values(NodeType), required: true }
    },
    to: {
        id: { type: Schema.Types.ObjectId, required: true, refPath: 'to.type' },
        type: { type: String, enum: Object.values(NodeType), required: true }
    },
    relation: { type: String, enum: Object.values(EdgeType), required: true, index: true },
    weight: { type: Number, default: 1.0, min: 0, max: 1 },
    metadata: { type: Map, of: Schema.Types.Mixed, default: {} }
}, {
    timestamps: true,
    collection: 'graph_edges'
});

// Compound Indexes for fast traversal
// 1. "Find all Goals of User X" -> { "from.id": 1, "relation": 1 }
GraphEdgeSchema.index({ "from.id": 1, relation: 1 });

// 2. "Find what triggers Anxiety" -> { "to.id": 1, "relation": 1 }
GraphEdgeSchema.index({ "to.id": 1, relation: 1 });

// 3. Unique edge constraint (User can't HAVE_GOAL the same goal twice)
GraphEdgeSchema.index({ "from.id": 1, "to.id": 1, relation: 1 }, { unique: true });

export const GraphEdge = mongoose.model<IGraphEdge>('GraphEdge', GraphEdgeSchema);
