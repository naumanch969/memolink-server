import mongoose, { Model, Schema } from 'mongoose';
import { NodeType } from '../graph/edge.model';
import { IKnowledgeEntity } from './entity.types';

const knowledgeEntitySchema = new Schema<IKnowledgeEntity>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        name: { type: String, required: true, trim: true, maxlength: 200 },
        aliases: [{ type: String, trim: true }],
        otype: {
            type: String,
            enum: Object.values(NodeType),
            required: true,
            default: NodeType.ENTITY,
            index: true
        },

        // Contact & Professional
        email: { type: String, trim: true, lowercase: true },
        phone: { type: String, trim: true },
        avatar: { type: String },
        jobTitle: { type: String, trim: true },
        company: { type: String, trim: true },
        role: { type: String, trim: true },
        birthday: { type: Date },
        address: {
            street: { type: String, trim: true },
            city: { type: String, trim: true },
            state: { type: String, trim: true },
            country: { type: String, trim: true },
            zipCode: { type: String, trim: true },
        },

        // Living Narrative
        rawMarkdown: { type: String, default: '' },
        summary: { type: String, default: '' },

        // Metrics
        tags: [{ type: String, trim: true }],
        interactionCount: { type: Number, default: 0 },
        lastInteractionAt: { type: Date },
        lastInteractionSummary: { type: String },
        sentimentScore: { type: Number, default: 0 },

        // Schemaless Metadata (TAO inspired field)
        metadata: { type: Schema.Types.Mixed, default: {} },

        // Soft Delete
        isDeleted: { type: Boolean, default: false, index: true },
        deletedAt: { type: Date }
    },
    {
        timestamps: true,
        collection: 'knowledge_entities'
    }
);

// Compound Indexes for fast retrieval
knowledgeEntitySchema.index({ userId: 1, name: 1 });
knowledgeEntitySchema.index({ userId: 1, otype: 1 });
knowledgeEntitySchema.index({ userId: 1, interactionCount: -1 });

export const KnowledgeEntity: Model<IKnowledgeEntity> = mongoose.model<IKnowledgeEntity>('KnowledgeEntity', knowledgeEntitySchema);
export default KnowledgeEntity;
