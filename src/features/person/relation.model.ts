import mongoose, { Schema } from 'mongoose';
import { IRelation } from '../../shared/types';

const relationSchema = new Schema<IRelation>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sourceId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
    targetId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
    type: { type: String, required: true, trim: true },
    strength: { type: Number, min: 1, max: 10, default: 1 },
}, { timestamps: true });

// Ensure unique link between two people for a specific type (optional, but good for sanity)
// Or just index for querying
relationSchema.index({ userId: 1, sourceId: 1 });
relationSchema.index({ userId: 1, targetId: 1 });
relationSchema.index({ sourceId: 1, targetId: 1 }, { unique: true }); // Prevent duplicate edges between same pair? 
// Actually, let's just index them for lookups. bidirectional graphs might treat A->B same as B->A, 
// but for flexibility we often store one. Let's enforce unique pair direction to avoid duplicates.
// simpler: sourceId and targetId combination should be unique.

export const Relation = mongoose.model<IRelation>('Relation', relationSchema);
export default Relation;
