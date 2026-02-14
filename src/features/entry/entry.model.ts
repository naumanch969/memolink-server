import mongoose, { Schema } from 'mongoose';
import { ENTRY_TYPES } from '../../shared/constants';
import { IEntry } from './entry.interfaces';
import { classifyMood } from './mood.config';

const entrySchema = new Schema<IEntry>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'User ID is required'], index: true, },
  content: {
    type: String, required: false, trim: true,
    maxlength: [10000000, 'Content cannot exceed 10000000 characters'], // TODO: DECREASE this limit for free user
    default: ''
  },
  type: { type: String, enum: Object.values(ENTRY_TYPES), default: ENTRY_TYPES.TEXT, },
  mentions: [{ type: Schema.Types.ObjectId, ref: 'KnowledgeEntity', }], // TOOD: we can remove this since graph relation can manage this globally
  tags: [{ type: Schema.Types.ObjectId, ref: 'Tag', }],
  media: [{ type: Schema.Types.ObjectId, ref: 'Media', }],
  isPrivate: { type: Boolean, default: false, },
  isImportant: { type: Boolean, default: false, },
  isFavorite: { type: Boolean, default: false, },
  mood: { type: String, trim: true, maxlength: [50, 'Mood cannot exceed 50 characters'], },
  location: { type: String, trim: true, maxlength: [200, 'Location cannot exceed 200 characters'], },
  date: { type: Date, default: Date.now, index: true, },
  startDate: { type: Date, index: true, },
  endDate: { type: Date, index: true, },
  startTime: { type: String, trim: true, },
  endTime: { type: String, trim: true, },
  isMultiDay: { type: Boolean, default: false, },
  isEdited: { type: Boolean, default: false, },
  aiProcessed: { type: Boolean, default: false },
  status: { type: String, enum: ['ready', 'processing', 'failed', 'processed', 'captured'], default: 'ready', index: true },
  embeddings: { type: [Number], select: false }, // Exclude by default due to size
  moodMetadata: {
    category: { type: String },
    score: { type: Number },
    color: { type: String },
    icon: { type: String },
  },
  metadata: { type: Object, default: {} },
}, {
  timestamps: true,
});

// Indexes
entrySchema.index({ userId: 1, createdAt: -1 });
entrySchema.index({ userId: 1, type: 1 });
entrySchema.index({ mentions: 1 });
entrySchema.index({ tags: 1 });
entrySchema.index({ media: 1 });
entrySchema.index({ isPrivate: 1 });

// Text search index
entrySchema.index({ content: 'text', mood: 'text', location: 'text' });

// Virtual for formatted content
entrySchema.virtual('formattedContent').get(function () {
  return this.content.replace(/\n/g, '<br>');
});

// Virtual for word count
entrySchema.virtual('wordCount').get(function () {
  return this.content.split(/\s+/).filter(word => word.length > 0).length;
});

// Pre-save middleware
entrySchema.pre('save', function (this: any, next) {
  // Auto-detect entry type based on content
  if (this.media && this.media.length > 0) {
    this.type = this.content.trim() ? ENTRY_TYPES.MIXED : ENTRY_TYPES.MEDIA;
  } else {
    this.type = ENTRY_TYPES.TEXT;
  }

  // Auto-classify mood if changed or missing metadata
  if (this.mood && (!this.moodMetadata || this.isModified('mood'))) {
    this.moodMetadata = classifyMood(this.mood);
  }

  next();
});

// Static methods
entrySchema.statics.findByUser = function (userId: string, options: any = {}) {
  const query = { userId, ...options };
  return this.find(query).sort({ createdAt: -1 });
};

entrySchema.statics.findByMention = function (entityId: string) {
  return this.find({ mentions: entityId }).sort({ createdAt: -1 });
};

entrySchema.statics.findByTag = function (tagId: string) {
  return this.find({ tags: tagId }).sort({ createdAt: -1 });
};

entrySchema.statics.searchEntries = function (userId: string, searchQuery: string) {
  return this.find({
    userId,
    $text: { $search: searchQuery },
  }).sort({ score: { $meta: 'textScore' } });
};

export const Entry = mongoose.model<IEntry>('Entry', entrySchema);
export default Entry;
