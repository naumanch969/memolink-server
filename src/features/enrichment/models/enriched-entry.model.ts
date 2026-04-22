import mongoose, { Schema } from 'mongoose';
import { IEnrichedEntryDocument, CognitiveLoad, EnergyLevel, InputMethod, ProcessingStatus, SignalTier, SourceType } from '../enrichment.types';

const enrichedEntrySchema = new Schema<IEnrichedEntryDocument>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referenceId: { type: Schema.Types.ObjectId, ref: 'Entry', index: true },
    sessionId: { type: String, required: true, index: true },
    sourceType: { type: String, enum: Object.values(SourceType), required: true, index: true },
    inputMethod: { type: String, enum: Object.values(InputMethod), required: true },
    processingStatus: { type: String, enum: Object.values(ProcessingStatus), default: ProcessingStatus.PENDING, index: true },
    signalTier: { type: String, enum: Object.values(SignalTier), index: true },

    metadata: {
        themes: [{ type: String, index: true }],
        emotions: [{
            label: { type: String },
            intensity: { type: Number }
        }],
        entities: [{
            entityId: { type: Schema.Types.ObjectId, ref: 'KnowledgeEntity' },
            name: { type: String },
            type: { type: String, enum: ['person', 'place', 'concept', 'project', 'organization'] },
            confidence: { type: Number },
            source: { type: String, enum: ['user', 'extracted'] }
        }],
        sentimentScore: { type: Number, default: 0 },
        energyLevel: { type: String, enum: Object.values(EnergyLevel) },
        cognitiveLoad: { type: String, enum: Object.values(CognitiveLoad) }
    },

    narrative: {
        signal: { type: String },
        coreThought: { type: String },
        contradictions: [{ type: String }],
        openLoops: [{ type: String }],
        selfPerception: { type: String },
        desires: [{ type: String }],
        fears: [{ type: String }]
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
    healingAttempts: { type: Number, default: 0, index: true },
    timestamp: { type: Date, required: true, index: true }
}, {
    timestamps: true
});

// Compound Indexes for fast retrieval
enrichedEntrySchema.index({ userId: 1, timestamp: -1 });
enrichedEntrySchema.index({ userId: 1, sessionId: 1, sourceType: 1 }, { unique: true });
enrichedEntrySchema.index({ userId: 1, sourceType: 1, timestamp: -1 });

// Vector Search Index placeholder (Index to be created in MongoDB Atlas)
// Name: enriched_vector_index
// Fields: embedding (vector), userId (filter)

export const EnrichedEntry = mongoose.model<IEnrichedEntryDocument>('EnrichedEntry', enrichedEntrySchema);
export default EnrichedEntry;
