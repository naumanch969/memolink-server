import mongoose, { Schema } from 'mongoose';
import { IEnrichedEntryDocument } from '../enrichment.types';

const enrichedEntrySchema = new Schema<IEnrichedEntryDocument>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referenceId: { type: Schema.Types.ObjectId, ref: 'Entry', index: true },
    sessionId: { type: String, required: true, index: true },
    sourceType: { type: String, enum: ['active', 'passive'], required: true, index: true },
    inputMethod: { type: String, enum: ['text', 'voice', 'whatsapp', 'system'], required: true },
    processingStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending', index: true },

    content: { type: String, required: true },

    metadata: {
        themes: [{ type: String, index: true }],
        emotions: [{
            name: { type: String },
            score: { type: Number },
            icon: { type: String }
        }],
        people: [{
            name: { type: String },
            role: { type: String },
            sentiment: { type: Number }
        }],
        entities: [{
            entityId: { type: Schema.Types.ObjectId, ref: 'KnowledgeEntity' },
            name: { type: String },
            type: { type: String },
            confidence: { type: Number }
        }],
        sentimentScore: { type: Number, default: 0 },
        energyLevel: { type: String, enum: ['low', 'medium', 'high'] },
        cognitiveLoad: { type: String, enum: ['focused', 'scattered', 'ruminating'] }
    },

    extraction: {
        confidenceScore: { type: Number, default: 0, index: true },
        modelVersion: { type: String },
        flags: [{ type: String }]
    },

    analytics: {
        totalDuration: { type: Number, default: 0 },
        topApp: { type: String },
        significanceScore: { type: Number, default: 0, index: true }
    },

    embedding: { type: [Number], select: false },
    timestamp: { type: Date, default: Date.now, index: true }
}, {
    timestamps: true
});

// Compound Indexes for fast retrieval
enrichedEntrySchema.index({ userId: 1, timestamp: -1 });
enrichedEntrySchema.index({ userId: 1, sessionId: 1 });
enrichedEntrySchema.index({ userId: 1, sourceType: 1, timestamp: -1 });

// Vector Search Index placeholder (Index to be created in MongoDB Atlas)
// Name: enriched_vector_index
// Fields: embedding (vector), userId (filter)

export const EnrichedEntry = mongoose.model<IEnrichedEntryDocument>('EnrichedEntry', enrichedEntrySchema);
export default EnrichedEntry;
